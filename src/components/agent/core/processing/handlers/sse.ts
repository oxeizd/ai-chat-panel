import { ResolvedEndpointConfig } from '../../config/types';
import { HttpResponse } from '../../execution/httpClient';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from './response';
import { parseSSEStream } from '../parsers/sseParser';
import { extractValueByPath } from 'components/agent/shared/utils/objectHelpers';
import { extractReasoning } from '../helpers/reasoning';

export class SseHandler implements ResponseHandler {
  canHandle(resolved: ResolvedEndpointConfig, _res: HttpResponse): boolean {
    return resolved.streaming !== null;
  }

  async handle(resolved: ResolvedEndpointConfig, res: HttpResponse, opt: HandlerOptions): Promise<ProcessedResponse> {
    if (!res.body) {
      throw new Error('SSE response must have a body');
    }

    const { streaming, reasoning, conversationHistory } = resolved;
    const { textPath, dataPrefix } = streaming!;
    const historySync = conversationHistory?.historySync;

    let fullReasoning = '';
    let fullVisible = '';
    let historyWasSynced = false;

    const onSync = (event: any) => {
      if (historySync && event.type === historySync.eventType) {
        const msgs = extractValueByPath(event, historySync.messagesPath);
        if (Array.isArray(msgs)) {
          opt.eventBus.emit('contextUpdate', { messages: msgs });
          historyWasSynced = true;
          opt.onTrace?.({
            type: 'context_update',
            timestamp: Date.now(),
            contextChanges: { messages_snapshot: msgs },
          });
        }
      }
    };

    const onChunk = (chunk: string) => {
      fullVisible += chunk;
      opt.eventBus.emit('chunk', chunk);
    };

    const onReasoningChunk = (rChunk: string) => {
      if (reasoning) {
        fullReasoning += rChunk;
        opt.eventBus.emit('reasoningChunk', rChunk);
      }
    };

    const result = await parseSSEStream(res as any, {
      textPath,
      dataPrefix,
      reasoningApiField: reasoning?.apiField,
      onChunk,
      onReasoningChunk,
      onHistorySync: onSync,
      onTrace: opt.onTrace,
    });

    // После получения полного текста – удаляем теги мышления, как в json.ts
    let finalReply = fullVisible;
    let finalReasoning = fullReasoning;
    if (reasoning) {
      // Используем extractReasoning для очистки fullVisible от тегов
      const { reasoningText, cleanReply } = extractReasoning(
        { reply: fullVisible }, // передаём фиктивный объект, извлекать будем из replyText
        fullVisible,
        reasoning,
        opt.eventBus
      );
      if (reasoningText) {
        // Если в процессе уже накоплен reasoning из стрима, объединяем (на случай дублей)
        finalReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
      }
      finalReply = cleanReply;
    }

    const data = {
      reply: finalReply,
      thinking: finalReasoning,
      finalMetadata: result.finalEvent,
      rawEvents: result.rawEvents,
    };

    return {
      data,
      replyText: finalReply,
      reasoningText: finalReasoning,
      rawText: result.fullText,
      rawEvents: result.rawEvents,
      historySynced: historyWasSynced,
    };
  }
}