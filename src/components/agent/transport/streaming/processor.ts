import { EndpointConfig, TraceStep } from 'types';
import { EventBus } from 'components/agent/core/eventBus';
import { applySaveToContext } from 'components/agent/utils/utils';
import { syncIncomingHistory } from 'components/agent/core/historyManager';
import { createInitialReasoningState, processReasoningChunk, finalizeReasoning } from '../reasoning/processor';
import { ReasoningState } from '../reasoning/types';

export interface StreamProcessingState {
  fullReply: string;
  reasoningState: ReasoningState;
}

export interface ProcessChunkOptions {
  onTrace?: (step: TraceStep) => void;
  eventType?: string;
}

export function createInitialStreamState(): StreamProcessingState {
  return {
    fullReply: '',
    reasoningState: createInitialReasoningState(),
  };
}

export function processStreamChunk(
  parsedChunk: any,
  op: EndpointConfig,
  context: Record<string, any>,
  state: StreamProcessingState,
  eventBus: EventBus,
  options?: ProcessChunkOptions
): StreamProcessingState {
  let newState = { ...state };
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
    newState.reasoningState = processReasoningChunk(
      parsedChunk,
      op.reasoning,
      newState.reasoningState,
      eventBus,
      onTrace,
      eventType
    );
  }

  // 3. Сохранение полей в контекст
  applySaveToContext(context, op.saveToContext, parsedChunk);

  return newState;
}

export function finalizeStream(state: StreamProcessingState, eventBus: EventBus): StreamProcessingState {
  const finalReasoningState = finalizeReasoning(state.reasoningState, eventBus);

  return {
    fullReply: state.fullReply,
    reasoningState: finalReasoningState,
  };
}
