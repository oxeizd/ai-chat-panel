import { ReasoningConfig } from 'types';
import { ReasoningState, ReasoningChunkContext, ReasoningExtractContext } from './types';
import { dotGet } from 'components/agent/utils/utils';

/** Обработка одного чанка для embedded-режима (api_field или thinking_tags) */
export function processEmbeddedChunk(ctx: ReasoningChunkContext): ReasoningState {
  const { parsedChunk, config, state, eventBus } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'embedded' }>;

  let newState = { ...state };

  if (r.mode === 'api_field' && r.apiField) {
    const reasChunk = dotGet(parsedChunk, r.apiField);
    if (typeof reasChunk === 'string' && reasChunk) {
      if (!newState.active) {
        newState.active = true;
        eventBus.emit('reasoning:start', undefined);
      }
      newState.fullText += reasChunk;
      eventBus.emit('reasoning:chunk', reasChunk);
    }
  }

  return newState;
}

export function extractEmbeddedFinal(ctx: ReasoningExtractContext): { cleanedReply: any; extracted: boolean } {
  const { parsedBody, reply, config, eventBus } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'embedded' }>;

  let cleanedReply = reply;
  let extracted = false;

  if (r.mode === 'api_field' && r.apiField) {
    const reasoningText = dotGet(parsedBody, r.apiField);
    if (typeof reasoningText === 'string' && reasoningText) {
      eventBus.emit('reasoning:start', undefined);
      eventBus.emit('reasoning:chunk', reasoningText);
      eventBus.emit('reasoning:end', reasoningText);
      extracted = true;
    }
  } else if (r.mode === 'thinking_tags' && r.textPath) {
    let fullText = '';
    if (typeof reply === 'string') {
      fullText = reply;
    } else {
      const rawText = dotGet(parsedBody, r.textPath);
      if (typeof rawText === 'string') {
        fullText = rawText;
      }
    }
    if (fullText) {
      const startMarker = r.startMarker ?? '<?thinking?>';
      const endMarker = r.endMarker ?? '<?/thinking?>';
      const startIdx = fullText.indexOf(startMarker);
      const endIdx = fullText.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const thinking = fullText.substring(startIdx + startMarker.length, endIdx);
        const before = fullText.substring(0, startIdx);
        const after = fullText.substring(endIdx + endMarker.length);
        cleanedReply = before + after;
        eventBus.emit('reasoning:start', undefined);
        eventBus.emit('reasoning:chunk', thinking);
        eventBus.emit('reasoning:end', thinking);
        extracted = true;
      }
    }
  }

  return { cleanedReply, extracted };
}

export function processSeparateChunk(ctx: ReasoningChunkContext & { eventType?: string }): ReasoningState {
  const { parsedChunk, config, state, eventBus, eventType } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'separate' }>;

  if (!r.eventType) {
    return state;
  }

  if (eventType !== r.eventType) {
    return state;
  }

  let chunkText: string | undefined;
  if (r.contentField) {
    chunkText = dotGet(parsedChunk, r.contentField);
  } else {
    chunkText = typeof parsedChunk === 'string' ? parsedChunk : undefined;
  }

  if (typeof chunkText === 'string' && chunkText) {
    let newState = { ...state };
    if (!newState.active) {
      newState.active = true;
      eventBus.emit('reasoning:start', undefined);
    }
    newState.fullText += chunkText;
    eventBus.emit('reasoning:chunk', chunkText);

    if (r.resultField) {
      const resultValue = dotGet(parsedChunk, r.resultField);
      if (typeof resultValue === 'string' && resultValue.toLowerCase().includes('end')) {
        eventBus.emit('reasoning:end', newState.fullText);
        newState.active = false;
      }
    }

    return newState;
  }

  return state;
}

export function extractSeparateFinal(ctx: ReasoningExtractContext): { cleanedReply: any; extracted: boolean } {
  const { parsedBody, reply, config, eventBus } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'separate' }>;

  let cleanedReply = reply;
  let extracted = false;

  if (r.contentField) {
    const reasoningText = dotGet(parsedBody, r.contentField);
    if (typeof reasoningText === 'string' && reasoningText) {
      eventBus.emit('reasoning:start', undefined);
      eventBus.emit('reasoning:chunk', reasoningText);
      eventBus.emit('reasoning:end', reasoningText);
      extracted = true;
    }
  }
  return { cleanedReply, extracted };
}
