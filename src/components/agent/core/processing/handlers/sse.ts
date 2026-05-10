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

    // Separate – новый протокол событий
    if (reasoning?.format === 'separate') {
      const eventMapping = {
        thinkingContent: reasoning.eventMapping?.thinkingContent ?? 'THINKING_TEXT_MESSAGE_CONTENT',
        thinkingStart: reasoning.eventMapping?.thinkingStart,
        thinkingEnd: reasoning.eventMapping?.thinkingEnd,
      };
      const { fullText, fullReasoning: reas } = await parseSeparateSSE(res as any, eventMapping, {
        onChunk: (chunk) => {
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          fullReasoning += chunk;
          opt.eventBus.emit('reasoningChunk', chunk);
        },
        onThinkingStart: (title) => opt.eventBus.emit('thinkingStart', title),
        onThinkingEnd: () => opt.eventBus.emit('thinkingEnd'),
        onTrace: opt.onTrace,
      });
      fullVisible = fullText;
      fullReasoning = reas;
    }
    // Embedded – старый способ (по полям или тегам)
    else {
      const { textPath, dataPrefix } = streaming!;
      const result = await parseSSEStream(res as any, {
        textPath,
        dataPrefix,
        reasoningApiField: reasoning?.apiField,
        onChunk: (chunk) => {
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          if (reasoning) {
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
      if (reasoning && reasoning.format === 'embedded') {
        const { reasoningText, cleanReply } = extractReasoning({ reply: fullVisible }, fullVisible, reasoning);
        if (reasoningText) {
          fullReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
        }
        fullVisible = cleanReply;
      }
    }

    // Формируем ответ
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
