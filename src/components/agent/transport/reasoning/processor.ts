import { ReasoningConfig, TraceStep } from 'types';
import { EventBus } from 'components/agent/core/eventBus';
import { ReasoningState } from './types';
import { processEmbeddedChunk, extractEmbeddedFinal, processSeparateChunk, extractSeparateFinal } from './parsers';

/** Начальное состояние */
export function createInitialReasoningState(): ReasoningState {
  return { active: false, fullText: '' };
}

/** Завершить reasoning, если активен */
export function finalizeReasoning(state: ReasoningState, eventBus: EventBus): ReasoningState {
  if (state.active) {
    eventBus.emit('reasoning:end', state.fullText);
    return { active: false, fullText: state.fullText };
  }
  return state;
}

/** Обработать один чанк (для SSE, JSONL) */
export function processReasoningChunk(
  parsedChunk: any,
  config: ReasoningConfig,
  state: ReasoningState,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void,
  eventType?: string
): ReasoningState {
  if (!config.enabled) {
    return state;
  }

  if (config.type === 'embedded') {
    return processEmbeddedChunk({ parsedChunk, config, state, eventBus, onTrace });
  } else if (config.type === 'separate') {
    return processSeparateChunk({ parsedChunk, config, state, eventBus, onTrace, eventType });
  }

  return state;
}

/** Извлечь reasoning из полного ответа (не-стриминг) и вернуть очищенный reply */
export function extractReasoningFromFullResponse(
  parsedBody: any,
  reply: any,
  config: ReasoningConfig,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): { cleanedReply: any; extracted: boolean } {
  if (!config.enabled) {
    return { cleanedReply: reply, extracted: false };
  }

  if (config.type === 'embedded') {
    return extractEmbeddedFinal({ parsedBody, reply, config, eventBus, onTrace });
  } else if (config.type === 'separate') {
    return extractSeparateFinal({ parsedBody, reply, config, eventBus, onTrace });
  }

  return { cleanedReply: reply, extracted: false };
}
