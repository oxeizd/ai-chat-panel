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
    let finalEvent: any = null;
    let rawEvents: any[] = [];
    let finalMetadata: { threadId?: string; runId?: string } | null = null;

    // Separate – протокол событий
    if (reasoning?.format === 'separate') {
      const eventMapping = {
        thinkingContent: reasoning.eventMapping?.thinkingContent ?? 'THINKING_TEXT_MESSAGE_CONTENT',
        thinkingStart: reasoning.eventMapping?.thinkingStart,
        thinkingEnd: reasoning.eventMapping?.thinkingEnd,
      };
      const { fullText, fullReasoning: reas } = await parseSeparateSSE(res as any, eventMapping, {
        onChunk: (chunk) => {
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
            opt.onTrace?.({
              type: 'reasoning_complete',
              timestamp: Date.now(),
              fullReasoning,
            });
          }
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          if (!reasoningStarted) {
            reasoningStarted = true;
            opt.eventBus.emit('thinkingStart');
            opt.onTrace?.({ type: 'thinking_start', timestamp: Date.now() });
          }
          fullReasoning += chunk;
          opt.eventBus.emit('reasoningChunk', chunk);
        },
        onThinkingStart: (title) => {
          if (!reasoningStarted) {
            reasoningStarted = true;
            opt.eventBus.emit('thinkingStart', title);
            opt.onTrace?.({ type: 'thinking_start', timestamp: Date.now(), title });
          }
        },
        onThinkingEnd: () => {
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now(), fullReasoning });
          }
        },
        onTrace: opt.onTrace,
      });
      fullVisible = fullText;
      fullReasoning = reas;
    }
    // Embedded – стандартный SSE
    else {
      const { textPath, dataPrefix } = streaming!;
      const result = await parseSSEStream(res as any, {
        textPath,
        dataPrefix,
        reasoningApiField: reasoning?.apiField,
        onChunk: (chunk) => {
          if (reasoningStarted && !reasoningCompleted) {
            reasoningCompleted = true;
            opt.eventBus.emit('reasoningComplete', fullReasoning);
            opt.eventBus.emit('thinkingEnd');
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now(), fullReasoning });
          }
          fullVisible += chunk;
          opt.eventBus.emit('chunk', chunk);
        },
        onReasoningChunk: (chunk) => {
          if (reasoning) {
            if (!reasoningStarted) {
              reasoningStarted = true;
              opt.eventBus.emit('thinkingStart');
              opt.onTrace?.({ type: 'thinking_start', timestamp: Date.now() });
            }
            fullReasoning += chunk;
            opt.eventBus.emit('reasoningChunk', chunk);
          }
        },
        onHistorySync: (event) => {
          // Кастомный historySync из конфига
          if (historySync && event.type === historySync.eventType) {
            const msgs = extractValueByPath(event, historySync.messagesPath);
            if (Array.isArray(msgs)) {
              opt.eventBus.emit('contextUpdate', { messages: msgs });
              historyWasSynced = true;
              opt.onTrace?.({
                type: 'history_sync',
                timestamp: Date.now(),
                messagesCount: msgs.length,
              });
            }
          }
          // fallback для MESSAGES_SNAPSHOT
          if (!historySync && event.type === 'MESSAGES_SNAPSHOT' && Array.isArray(event.messages)) {
            opt.eventBus.emit('contextUpdate', { messages: event.messages });
            historyWasSynced = true;
            opt.onTrace?.({
              type: 'history_sync',
              timestamp: Date.now(),
              messagesCount: event.messages.length,
            });
          }
          // захват финальных метаданных
          if (event.type === 'RUN_FINISHED') {
            finalMetadata = { threadId: event.threadId, runId: event.runId };
          }
        },
        onTrace: opt.onTrace,
      });
      fullVisible = result.fullText;
      finalEvent = result.finalEvent;
      rawEvents = result.rawEvents;

      // Если в rawEvents есть RUN_FINISHED, извлекаем метаданные
      if (!finalMetadata) {
        const runFinished = rawEvents.find((e) => e.type === 'RUN_FINISHED');
        if (runFinished) {
          finalMetadata = { threadId: runFinished.threadId, runId: runFinished.runId };
        }
      }

      // Режим thinking_tags
      if (reasoning && reasoning.format === 'embedded') {
        const { reasoningText, cleanReply } = extractReasoning({ reply: fullVisible }, fullVisible, reasoning);
        if (reasoningText) {
          fullReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
          opt.onTrace?.({
            type: 'reasoning_extracted_from_tags',
            timestamp: Date.now(),
            reasoningText,
          });
        }
        if (cleanReply !== fullVisible) {
          opt.onTrace?.({
            type: 'text_cleaned_from_tags',
            timestamp: Date.now(),
            cleanedText: cleanReply,
          });
        }
        fullVisible = cleanReply;
      }
    }

    // Если reasoning начался, но не завершился
    if (reasoningStarted && !reasoningCompleted) {
      opt.eventBus.emit('reasoningComplete', fullReasoning);
      opt.eventBus.emit('thinkingEnd');
      opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now(), fullReasoning });
    }

    // Формируем полный ответ (как в старом executionEngine)
    const data: any = {
      reply: fullVisible,
      result: fullVisible,
      thinking: fullReasoning,
      finalMetadata: finalMetadata,
      rawEvents: rawEvents,
      choices: [{ message: { content: fullVisible, role: 'assistant' } }],
    };

    // Добавляем поля из финального события, если есть
    if (finalEvent) {
      if (finalEvent.threadId) {
        data.threadId = finalEvent.threadId;
      }
      if (finalEvent.runId) {
        data.runId = finalEvent.runId;
      }
      if (finalEvent.id) {
        data.id = finalEvent.id;
      }
    }

    return {
      data,
      replyText: fullVisible,
      reasoningText: fullReasoning,
      historySynced: historyWasSynced,
      rawEvents: rawEvents,
    };
  }
}
