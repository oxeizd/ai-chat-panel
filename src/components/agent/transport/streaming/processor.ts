import { EndpointConfig, TraceStep, ChartData } from 'types';
import { EventBus } from 'components/agent/core/eventBus';
import { applySaveToContext } from 'components/agent/utils/utils';
import { syncIncomingHistory } from 'components/agent/core/historyManager';
import { createInitialReasoningState, processReasoningChunk, finalizeReasoning } from '../reasoning/processor';
import { ReasoningState } from '../reasoning/types';
import { matchCustomEventHandler, applyCustomEventHandler, normalizeChartData } from './customEvents';

export interface StreamProcessingState {
  fullReply: string;
  reasoningState: ReasoningState;
  /** Графики из CUSTOM-событий (render:'chart'). */
  charts: ChartData[];
  /** Текст ошибки из RUN_ERROR / render:'error'. */
  streamError?: string;
  /** Текущий messageId потока (для AG-UI границ сообщений). */
  currentMessageId?: string;
  /** Есть ли уже непустой текст в ответе (нужен ли разделитель перед следующим сообщением). */
  hasText?: boolean;
  /** Значения из событий с render:'context' — мержатся в session context после потока. */
  pendingContext: Record<string, any>;
}

export interface ProcessChunkOptions {
  onTrace?: (step: TraceStep) => void;
  eventType?: string;
}

export function createInitialStreamState(): StreamProcessingState {
  return {
    fullReply: '',
    reasoningState: createInitialReasoningState(),
    charts: [],
    currentMessageId: undefined,
    hasText: false,
    pendingContext: {},
  };
}

/**
 * Добавляет график в состояние потока. Каждый корректно распознанный график
 * показывается ровно один раз (см. processCustomEvent: событие матчится одним
 * правилом либо fallback'ом, но не обоими сразу).
 */
export function addChartToState(state: StreamProcessingState, chart: ChartData): void {
  state.charts.push(chart);
}

/**
 * Добавляет дельту текста в ответ с учётом границ AG-UI-сообщений:
 * при смене messageId между кусками вставляется пустая строка,
 * чтобы «...помочь?» и «Генерирую...» не склеивались.
 * Пустые/пробельные дельты не игнорируются — сервер может явно слать '\n\n'.
 */
export function appendTextDelta(
  state: StreamProcessingState,
  delta: string,
  eventBus: EventBus,
  opts?: {
    paragraphBetweenMessages?: boolean;
    messageId?: string;
    boundaryMessageId?: string;
    /** true — накопить текст в fullReply, но не эмитить 'chunk' (rule.silent). */
    silent?: boolean;
  }
): StreamProcessingState {
  let prefix = '';

  if (opts?.paragraphBetweenMessages !== false) {
    // Граница явная (TEXT_MESSAGE_START с новым messageId) или неявная —
    // по смене messageId у дельты TEXT_MESSAGE_CONTENT.
    const isNewMessage =
      opts?.boundaryMessageId !== undefined ||
      (opts?.messageId !== undefined &&
        state.currentMessageId !== undefined &&
        state.currentMessageId !== opts.messageId);
    if (isNewMessage && delta) {
      // Не дублируем разделитель, если текст уже заканчивается переводом строк
      // (сервер может явно присылать '\n\n' отдельным сообщением).
      const alreadySeparated = state.fullReply.endsWith('\n\n');
      prefix = state.hasText && !alreadySeparated ? '\n\n' : '';
    }
  }

  const text = prefix + delta;

  if (!text) {
    if (opts?.messageId !== undefined) {
      state.currentMessageId = opts.messageId;
    }
    return state;
  }

  if (state.reasoningState.active) {
    state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
  }

  state.fullReply += text;
  if (text.trim().length > 0) {
    state.hasText = true;
  }
  if (opts?.messageId !== undefined) {
    state.currentMessageId = opts.messageId;
  }
  if (!opts?.silent) {
    eventBus.emit('chunk', text);
  }

  return state;
}

/**
 * Применяет правила customEvents (AG-UI CUSTOM / RUN_ERROR и т.п.) к событию.
 * Мутирует и возвращает состояние потока.
 */
export function processCustomEvent(
  parsedChunk: any,
  op: EndpointConfig,
  state: StreamProcessingState,
  eventBus: EventBus
): StreamProcessingState {
  const streaming = op.streaming;
  const rules = streaming && streaming.enabled ? streaming.customEvents : undefined;

  const rule = matchCustomEventHandler(parsedChunk, rules);
  if (!rule) {
    // Fallback для AG-UI: CUSTOM-событие без name, но с данными графика прямо в событии
    // (например, {type:"CUSTOM", chart:{...}} — форма из спецификации AG-UI без поля value).
    // Матчится ТОЛЬКО объект chart на верхнем уровне: если у пользователя настроено
    // правило под этот же тип события, fallback отключается (см. ниже), чтобы
    // одно событие не породило два графика (костыль-дубль).
    if (parsedChunk && parsedChunk.type === 'CUSTOM' && !rules?.length) {
      const chartSrc = parsedChunk.chart;
      if (chartSrc && typeof chartSrc === 'object') {
        const fallbackChart = normalizeChartData(chartSrc);
        if (fallbackChart) {
          addChartToState(state, fallbackChart);
          eventBus.emit('chart', fallbackChart);
        }
      }
    }
    return state;
  }

  const result = applyCustomEventHandler(parsedChunk, rule);
  if (!result) {
    return state;
  }

  if (result.error) {
    state.streamError = result.error;
    return state;
  }

  if (result.chart) {
    addChartToState(state, result.chart);
    eventBus.emit('chart', result.chart);
    return state;
  }

  if (result.contextUpdate) {
    Object.assign(state.pendingContext, result.contextUpdate);
    return state;
  }

  if (typeof result.text === 'string') {
    if (result.intoReasoning) {
      // Направляем значение события в reasoning (спойлер «Думает…») через separate-конфиг.
      state.reasoningState = processReasoningChunk(
        parsedChunk,
        { enabled: true, type: 'separate', eventType: rule.eventType, contentField: rule.valuePath ?? 'value' },
        state.reasoningState,
        eventBus
      );
      return state;
    }

    const paragraphPrefix = result.paragraph && state.hasText ? '\n\n' : '';
    return appendTextDelta(state, paragraphPrefix + result.text, eventBus, {
      paragraphBetweenMessages: false,
      silent: result.silent,
    });
  }

  return state;
}

/**
 * Защита от дублирования графиков удалена намеренно.
 * Один график = одно событие CUSTOM: матчинг правил даёт максимум одно правило,
 * fallback включается только когда правил нет вообще. Дедуп по JSON-содержимому
 * маскировал баги (склейка live+stepResults) и молча глотал легитимные одинаковые
 * графики — см. agent.ts (chartsEmittedDuringStream) как единственную защиту
 * от двойного прохода live/пост-workflow.
 */

export function processStreamChunk(
  parsedChunk: any,
  op: EndpointConfig,
  context: Record<string, any>,
  state: StreamProcessingState,
  eventBus: EventBus,
  options?: ProcessChunkOptions
): StreamProcessingState {
  const { onTrace, eventType } = options || {};

  // 1. History sync (incoming_sync) — сервер присылает полный список
  // сообщений (включая свою реплику) в событии с типом historySync.eventType.
  const history = op.historyConfig;
  if (history?.enabled && history.mode === 'incoming_sync') {
    const sync = history.historySync;
    if (sync && eventType === sync.eventType) {
      syncIncomingHistory(context, history, parsedChunk, eventBus, onTrace);
    }
  }

  // 2. Reasoning
  if (op.reasoning?.enabled) {
    state.reasoningState = processReasoningChunk(
      parsedChunk,
      op.reasoning,
      state.reasoningState,
      eventBus,
      onTrace,
      eventType
    );
  }

  // 3. Сохранение полей в контекст
  applySaveToContext(context, op.saveToContext, parsedChunk);

  // 4. Произвольные события потока (AG-UI CUSTOM / RUN_ERROR и т.п.)
  state = processCustomEvent(parsedChunk, op, state, eventBus);

  return state;
}

export function finalizeStream(state: StreamProcessingState, eventBus: EventBus): StreamProcessingState {
  const finalReasoningState = finalizeReasoning(state.reasoningState, eventBus);

  return {
    ...state,
    reasoningState: finalReasoningState,
  };
}
