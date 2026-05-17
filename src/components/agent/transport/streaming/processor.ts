import { EndpointConfig, TraceStep } from 'types';
import { EventBus } from 'components/agent/core/eventBus';
import { DEFAULT_STREAMING } from 'components/agent/config/defaults';
import { dotGet, applySaveToContext } from 'components/agent/utils/utils';
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

  // 1. History sync (incoming_sync)
  const history = op.historyConfig;
  if (history?.enabled && history.mode === 'incoming_sync') {
    const sync = history.historySync;
    if (sync && eventType === sync.eventType) {
      const msgs = dotGet(parsedChunk, sync.messagesPath);
      if (Array.isArray(msgs)) {
        context.__history = msgs;
        eventBus.emit('contextUpdate', { messages: msgs });
      }
    }
  }

  // 2. Reasoning
  if (op.reasoning?.enabled) {
    newState.reasoningState = processReasoningChunk(
      parsedChunk,
      op.reasoning,
      newState.reasoningState,
      eventBus,
      onTrace
    );
  }

  // 3. Text chunk
  const streaming = op.streaming;
  if (streaming?.enabled) {
    const textPath = streaming.textPath ?? DEFAULT_STREAMING.textPath;
    const textChunk = dotGet(parsedChunk, textPath);
    if (typeof textChunk === 'string' && textChunk) {
      if (newState.reasoningState.active) {
        newState.reasoningState = finalizeReasoning(newState.reasoningState, eventBus);
      }
      newState.fullReply += textChunk;
      eventBus.emit('chunk', textChunk);
    }
  }

  // 4. Save fields to context
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
