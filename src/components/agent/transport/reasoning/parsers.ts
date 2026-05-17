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

  // thinking_tags в стриминге обычно не используется (только финальный ответ),

  return newState;
}

/** Обработка финального ответа для embedded-режима (возвращает cleanedReply) */
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

/** Обработка чанка для separate-режима (по event'ам) */
export function processSeparateChunk(ctx: ReasoningChunkContext): ReasoningState {
  const { parsedChunk, config, state, eventBus } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'separate' }>;

  let newState = { ...state };

  const eventType = r.eventType;
  if (eventType && (parsedChunk.type === eventType || parsedChunk.event === eventType)) {
    let chunkText = r.contentField ? dotGet(parsedChunk, r.contentField) : parsedChunk;
    if (typeof chunkText === 'string' && chunkText) {
      if (!newState.active) {
        newState.active = true;
        eventBus.emit('reasoning:start', undefined);
      }
      newState.fullText += chunkText;
      eventBus.emit('reasoning:chunk', chunkText);
    }

    const resultField = r.resultField;
    if (resultField && dotGet(parsedChunk, resultField) === 'end') {
      if (newState.active) {
        eventBus.emit('reasoning:end', newState.fullText);
        newState.active = false;
      }
    }
  }

  return newState;
}

/** Обработка финального ответа для separate-режима (один ответ, не стриминг) */
export function extractSeparateFinal(ctx: ReasoningExtractContext): { cleanedReply: any; extracted: boolean } {
  const { parsedBody, reply, config, eventBus } = ctx;
  const r = config as Extract<ReasoningConfig, { enabled: true; type: 'separate' }>;

  const contentField = r.contentField;
  const resultField = r.resultField;
  let extracted = false;
  let cleanedReply = reply;

  if (contentField) {
    const reasoningText = dotGet(parsedBody, contentField);
    if (typeof reasoningText === 'string' && reasoningText) {
      eventBus.emit('reasoning:start', undefined);
      eventBus.emit('reasoning:chunk', reasoningText);
      const isEnd = resultField ? dotGet(parsedBody, resultField) === 'end' : true;
      if (isEnd) {
        eventBus.emit('reasoning:end', reasoningText);
      } else {
        // для простоты считаем, что в не-стриминге reasoning заканчивается с ответом
        eventBus.emit('reasoning:end', reasoningText);
      }
      extracted = true;
    }
  }

  return { cleanedReply, extracted };
}
