import { ResolvedEndpointConfig } from '../../config/types';
import { HttpResponse } from '../../execution/httpClient';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from './response';
import { parseSSEStream } from '../parsers/embeddedSseParser';
import { parseSeparateSSE } from '../parsers/separateSseParser';
import { extractReasoning } from '../helpers/reasoning';
import { extractValueByPath } from 'components/agent/shared/utils/objectHelpers';

export class SseHandler implements ResponseHandler {
  canHandle(resolved: ResolvedEndpointConfig, _res: HttpResponse): boolean {
    return resolved.streaming !== null;
  }

  async handle(resolved: ResolvedEndpointConfig, res: HttpResponse, opt: HandlerOptions): Promise<ProcessedResponse> {
    if (!res.body) {
      throw new Error('SSE response must have a body');
    }

    const { streaming, reasoning, conversationHistory } = resolved;
    const historySync = conversationHistory?.historySync;

    let fullReasoning = '';
    let fullVisible = '';
    let historyWasSynced = false;
    let reasoningStarted = false;
    let reasoningCompleted = false;

    // Separate – протокол событий (например, от DeepSeek API)
    if (reasoning?.format === 'separate') {
      const eventMapping = {
        thinkingContent: reasoning.eventMapping?.thinkingContent ?? 'THINKING_TEXT_MESSAGE_CONTENT',
        thinkingStart: reasoning.eventMapping?.thinkingStart,
        thinkingEnd: reasoning.eventMapping?.thinkingEnd,
      };
      const { fullText, fullReasoning: reas } = await parseSeparateSSE(res as any, eventMapping, {
        onChunk: (chunk) => {
          // При получении обычного текста после reasoning завершаем режим мышления
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
          }
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          if (!reasoningStarted) {
            reasoningStarted = true;
            opt.eventBus.emit('thinkingStart');
          }
          fullReasoning += chunk;
          opt.eventBus.emit('reasoningChunk', chunk);
        },
        onThinkingStart: (title) => {
          if (!reasoningStarted) {
            reasoningStarted = true;
            opt.eventBus.emit('thinkingStart', title);
          }
        },
        onThinkingEnd: () => {
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
          }
        },
        onTrace: opt.onTrace,
      });
      fullVisible = fullText;
      fullReasoning = reas;
    }
    // Embedded – стандартный SSE с полем delta.content и, возможно, reasoningApiField
    else {
      const { textPath, dataPrefix } = streaming!;
      const result = await parseSSEStream(res as any, {
        textPath,
        dataPrefix,
        reasoningApiField: reasoning?.apiField,
        onChunk: (chunk) => {
          // При первом обычном тексте после завершения reasoning — финализируем reasoning
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
          }
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          if (reasoning) {
            if (!reasoningStarted) {
              reasoningStarted = true;
              opt.eventBus.emit('thinkingStart');
            }
            fullReasoning += chunk;
            opt.eventBus.emit('reasoningChunk', chunk);
          }
        },
        onHistorySync: (event) => {
          if (historySync && event.type === historySync.eventType) {
            const msgs = extractValueByPath(event, historySync.messagesPath);
            if (Array.isArray(msgs)) {
              opt.eventBus.emit('contextUpdate', { messages: msgs });
              historyWasSynced = true;
            }
          }
        },
        onTrace: opt.onTrace,
      });
      fullVisible = result.fullText;
      // Если используется режим thinking_tags (извлечение из финального текста)
      if (reasoning && reasoning.format === 'embedded') {
        const { reasoningText, cleanReply } = extractReasoning({ reply: fullVisible }, fullVisible, reasoning);
        if (reasoningText) {
          fullReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
        }
        fullVisible = cleanReply;
      }
    }

    // Если reasoning начался, но не завершился (например, не было обычных чанков)
    if (reasoningStarted && !reasoningCompleted) {
      opt.eventBus.emit('reasoningComplete', fullReasoning);
      opt.eventBus.emit('thinkingEnd');
    }

    const data = {
      reply: fullVisible,
      thinking: fullReasoning,
    };

    return {
      data,
      replyText: fullVisible,
      reasoningText: fullReasoning,
      historySynced: historyWasSynced,
    };
  }
}
