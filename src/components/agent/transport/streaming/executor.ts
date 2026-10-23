import { SSEParser, NdjsonParser } from './parsers';
import { EventBus } from 'components/agent/core/eventBus';
import { createInitialStreamState, processStreamChunk, finalizeStream } from './processor';
import { HttpResponse, EndpointConfig, TraceStep, SendResult } from 'types';
import { dotGet } from 'components/agent/utils/utils';
import { finalizeReasoning } from '../reasoning/processor';

function isStreamingEnabled(
  streaming: EndpointConfig['streaming']
): streaming is Extract<NonNullable<EndpointConfig['streaming']>, { enabled: true }> {
  return streaming !== null && typeof streaming === 'object' && streaming.enabled === true;
}

/**
 * Перенос строки между текстовыми сообщениями (event breaks).
 * undefined/true -> '\n\n' (каждое событие с новой строки, markdown-абзац), false -> '' (без переноса).
 */
function eventBreaksDelimiter(eventBreaks: boolean | undefined): string {
  return eventBreaks === false ? '' : '\n\n';
}

export async function handleStreamingResponse(
  op: EndpointConfig,
  response: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<SendResult> {
  const streaming = op.streaming;
  if (!isStreamingEnabled(streaming)) {
    return { ok: false, error: 'streaming not enabled' };
  }

  if (streaming.parseStrategy === 'sse') {
    const result = await handleSSEStream(op, response, context, eventBus, onTrace);
    return {
      ok: true,
      data: result.reply,
      context: result.context,
      reasoningText: result.reasoningText,
      isStreaming: true,
      lastEvent: result.lastEvent,
    };
  }

  if (streaming.parseStrategy === 'jsonl') {
    const result = await handleNdjsonStream(op, response, context, eventBus, onTrace);
    return {
      ok: true,
      data: result.reply,
      context: result.context,
      reasoningText: result.reasoningText,
      isStreaming: true,
      lastEvent: result.lastEvent,
    };
  }

  return { ok: false, error: `Unsupported parse strategy: ${streaming.parseStrategy}` };
}

/**
 * Обработка SSE с возможностью фильтрации событий по типу
 */
async function handleSSEStream(
  op: EndpointConfig,
  res: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<{ reply: string; reasoningText: string | undefined; context: Record<string, any>; lastEvent: any }> {
  if (!res.body) {
    throw new Error('SSE response has no body');
  }

  let lastEvent: any;
  let state = createInitialStreamState();

  const streaming = op.streaming;
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

  if (!isStreamingEnabled(streaming)) {
    throw new Error('Streaming config missing');
  }

  const textPath = streaming.textPath;
  const textEventType = streaming.textEventType;
  const textDeltaField = streaming.textDeltaField;
  // Стандартный SSE: сообщения разделяются пустой линией; настраивается только префикс данных.
  const parser = new SSEParser({ dataPrefix: streaming.dataPrefix });

  let rawMessages: string[] | undefined = onTrace ? [] : undefined;
  // Для markdown: каждое входящее текстовое сообщение начинаем с новой строки (event breaks).
  const messageDelimiter = eventBreaksDelimiter(streaming.eventBreaks);
  let emittedAnyText = false;
  // Универсальная логика границ сообщений (не зависит от конкретного формата стрима):
  // - если событие содержит messageId (AG-UI и подобные) — дельты одного messageId склеиваются,
  //   новый блок начинается при смене messageId или типа события;
  // - если messageId нет, но есть TEXT_MESSAGE_START/END (или RUN_STARTED/FINISHED) — границы задают они;
  // - если нет ни того, ни другого (OpenAI-style токенный стрим) — считаем это одним потоком текста
  //   и переносы между дельтами не вставляем (иначе текст рвался бы на куски).
  let currentTextMessageId: string | undefined;
  let lastTextEventType: string | undefined;
  // Флаг наличия в стриме явных границ сообщений (TEXT_MESSAGE_START/END).
  // Нужен, чтобы отличить «несколько сообщений без messageId» (нужен перенос)
  // от токенного стрима вроде OpenAI (одна строка текста, переносы не нужны).
  let sawStartEndEvents = false;
  // Тип последнего обработанного события (для RUN_* границ в стримах без messageId).
  let prevEventType: unknown;

  const isTextBoundaryEvent = (t: unknown): boolean =>
    typeof t === 'string' && (/^TEXT_MESSAGE_(START|END)$/.test(t) || /(^|_)(start|end|stop)(_|$)/i.test(t));

  const isRunBoundaryEvent = (t: unknown): boolean => typeof t === 'string' && /^RUN_(STARTED|FINISHED|ERROR)$/.test(t);

  // Возвращает префикс-перенос перед текстовой дельтой (если включены event breaks).
  const shouldBreakBefore = (parsedEvent: any): string => {
    if (!messageDelimiter || !emittedAnyText) {
      return '';
    }
    const msgId = typeof parsedEvent.messageId === 'string' ? parsedEvent.messageId : undefined;
    let isNewBlock = false;
    if (msgId !== undefined) {
      // Стрим с идентификаторами сообщений (AG-UI и т.п.): новый блок при смене messageId или типа события.
      isNewBlock = (!!msgId && currentTextMessageId !== msgId) || lastTextEventType !== parsedEvent.type;
    } else if (sawStartEndEvents) {
      // Сообщения разделены TEXT_MESSAGE_START/END — после границы каждое новое сообщение с новой строки.
      isNewBlock = currentTextMessageId === undefined || lastTextEventType !== parsedEvent.type;
    } else if (isRunBoundaryEvent(prevEventType)) {
      // Граница уровня запуска (RUN_STARTED/FINISHED) — новое сообщение.
      isNewBlock = true;
    }
    // Иначе: токенный стрим без messageId и START/END (OpenAI-style) — один поток, без переносов.
    if (isNewBlock) {
      return messageDelimiter;
    }
    return '';
  };

  const emitTextDelta = (textDelta: string, parsedEvent: any) => {
    const prefix = shouldBreakBefore(parsedEvent);
    currentTextMessageId = typeof parsedEvent.messageId === 'string' ? parsedEvent.messageId : undefined;
    lastTextEventType = parsedEvent.type;
    emittedAnyText = true;
    state.fullReply += prefix + textDelta;
    eventBus.emit('chunk', prefix + textDelta);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const messages = parser.feed(chunk);
      for (const msg of messages) {
        if (rawMessages) {
          rawMessages.push(msg.data);
        }
        if (msg.data === '[DONE]') {
          continue;
        }

        let parsedEvent: any;
        try {
          parsedEvent = JSON.parse(msg.data);
          lastEvent = parsedEvent;
        } catch {
          onTrace?.({ type: 'sse_parse_error', timestamp: Date.now(), rawLine: msg.data });
          continue;
        }

        let textDelta: string | null = null;
        if (textEventType) {
          if (parsedEvent.type === textEventType) {
            if (textDeltaField) {
              textDelta = parsedEvent[textDeltaField];
            } else if (textPath) {
              textDelta = dotGet(parsedEvent, textPath);
            }
          }
        } else {
          if (textPath) {
            textDelta = dotGet(parsedEvent, textPath);
          }
        }

        if (typeof textDelta === 'string' && textDelta) {
          if (state.reasoningState.active) {
            state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
          }
          emitTextDelta(textDelta, parsedEvent);
        } else if (isTextBoundaryEvent(parsedEvent.type)) {
          // TEXT_MESSAGE_START/END: следующее текстовое событие — новый блок.
          sawStartEndEvents = true;
          currentTextMessageId = undefined;
          lastTextEventType = undefined;
        }
        prevEventType = parsedEvent.type;

        state = processStreamChunk(parsedEvent, op, context, state, eventBus, {
          onTrace,
          eventType: parsedEvent.type,
        });
      }
    }

    const finalMessages = parser.flush();
    for (const msg of finalMessages) {
      if (msg.data === '[DONE]') {
        continue;
      }
      try {
        const parsedEvent = JSON.parse(msg.data);

        let textDelta: string | null = null;
        if (textEventType) {
          if (parsedEvent.type === textEventType) {
            if (textDeltaField) {
              textDelta = parsedEvent[textDeltaField];
            } else if (textPath) {
              textDelta = dotGet(parsedEvent, textPath);
            }
          }
        } else if (textPath) {
          textDelta = dotGet(parsedEvent, textPath);
        }

        if (typeof textDelta === 'string' && textDelta) {
          emitTextDelta(textDelta, parsedEvent);
        } else if (isTextBoundaryEvent(parsedEvent.type)) {
          sawStartEndEvents = true;
          currentTextMessageId = undefined;
          lastTextEventType = undefined;
        }
        prevEventType = parsedEvent.type;

        state = processStreamChunk(parsedEvent, op, context, state, eventBus, {
          onTrace,
          eventType: parsedEvent.type,
        });
      } catch {}
    }

    state = finalizeStream(state, eventBus);

    if (onTrace && rawMessages) {
      onTrace({
        type: 'fullStream',
        timestamp: Date.now(),
        responseBody: rawMessages.join('\n'),
        isStreaming: true,
      });
    }

    return {
      reply: state.fullReply,
      reasoningText: state.reasoningState.fullText,
      lastEvent,
      context,
    };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Обработка NDJSON (jsonl)
 */
async function handleNdjsonStream(
  op: EndpointConfig,
  res: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<{ reply: string; reasoningText: string | undefined; context: Record<string, any>; lastEvent: any }> {
  if (!res.body) {
    throw new Error('NDJSON response has no body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new NdjsonParser();
  let state = createInitialStreamState();
  let lastEvent: any;
  const streaming = op.streaming;
  if (!isStreamingEnabled(streaming)) {
    throw new Error('Streaming config missing');
  }

  const textPath = streaming.textPath;
  // event breaks: по умолчанию каждое текстовое сообщение с новой строки; false — склейка без переносов.
  // В jsonl дельты одного сообщения (например choices[0].delta.content) обычно идут непрерывным потоком,
  // поэтому дефолт для jsonl — без переносов; перенос добавляется только при явном eventBreaks === true.
  const messageDelimiter = streaming.eventBreaks === true ? '\n\n' : '';
  let emittedAnyText = false;
  let rawMessages: string[] | undefined = onTrace ? [] : undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const objects = parser.feed(chunk);
      for (const obj of objects) {
        if (rawMessages) {
          rawMessages.push(JSON.stringify(obj));
        }
        lastEvent = obj;

        let textDelta: string | null = null;
        if (textPath) {
          textDelta = dotGet(obj, textPath);
        }

        if (typeof textDelta === 'string' && textDelta) {
          if (state.reasoningState.active) {
            state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
          }
          // Каждое новое текстовое сообщение — с новой строки (для markdown-разметки).
          const prefix = emittedAnyText ? messageDelimiter : '';
          emittedAnyText = true;
          state.fullReply += prefix + textDelta;
          eventBus.emit('chunk', prefix + textDelta);
        }

        state = processStreamChunk(obj, op, context, state, eventBus, {
          onTrace,
          eventType: obj.type, // может быть undefined, но для jsonl обычно не нужен
        });
      }
    }

    const finalObjects = parser.flush();
    for (const obj of finalObjects) {
      state = processStreamChunk(obj, op, context, state, eventBus, { onTrace, eventType: obj.type });
    }

    state = finalizeStream(state, eventBus);

    if (onTrace && rawMessages) {
      onTrace({
        type: 'fullStream',
        timestamp: Date.now(),
        responseBody: rawMessages.join('\n'),
        isStreaming: true,
      });
    }

    return {
      reply: state.fullReply,
      reasoningText: state.reasoningState.fullText,
      lastEvent,
      context,
    };
  } finally {
    reader.releaseLock();
  }
}
