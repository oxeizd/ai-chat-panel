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
    let rawEvents: any[] = [];
    let runFinishedEvent: any = null;
    let lastAssistantMessageId: string | null = null;
    let assistantRole = 'assistant';
    let extraFields: any = {};

    // ----- Separate protocol -----
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
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now() });
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
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now() });
          }
        },
        onTrace: opt.onTrace,
      });
      fullVisible = fullText;
      fullReasoning = reas;
    }
    // ----- Embedded SSE -----
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
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now() });
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
          if (historySync && event.type === historySync.eventType) {
            const msgs = extractValueByPath(event, historySync.messagesPath);
            if (Array.isArray(msgs)) {
              historyWasSynced = true;
              opt.onTrace?.({ type: 'history_sync', timestamp: Date.now(), messagesCount: msgs.length });
              opt.eventBus.emit('contextUpdate', { messages: msgs });
            }
          }
          if (event.type === 'RUN_FINISHED') {
            runFinishedEvent = event;
          }
          if (event.type === 'TEXT_MESSAGE_START' && event.role === 'assistant') {
            lastAssistantMessageId = event.messageId;
            assistantRole = event.role;
          }
          // Собираем все поля из каждого события (кроме type) для последующего добавления в ответ
          Object.keys(event).forEach((key) => {
            if (key !== 'type' && extraFields[key] === undefined) {
              extraFields[key] = event[key];
            }
          });
        },
        onTrace: opt.onTrace,
      });

      fullVisible = result.fullText || fullVisible;
      rawEvents = result.rawEvents;

      if (!runFinishedEvent) {
        runFinishedEvent = rawEvents.find((e) => e.type === 'RUN_FINISHED');
      }
      if (!lastAssistantMessageId) {
        const startEvent = rawEvents.find((e) => e.type === 'TEXT_MESSAGE_START' && e.role === 'assistant');
        if (startEvent) {
          lastAssistantMessageId = startEvent.messageId;
          assistantRole = startEvent.role;
        }
      }
      // Дополнительный сбор полей из rawEvents, которые могли быть пропущены
      for (const ev of rawEvents) {
        Object.keys(ev).forEach((key) => {
          if (key !== 'type' && extraFields[key] === undefined) {
            extraFields[key] = ev[key];
          }
        });
      }

      if (reasoning && reasoning.format === 'embedded') {
        const { reasoningText, cleanReply } = extractReasoning({ reply: fullVisible }, fullVisible, reasoning);
        if (reasoningText) {
          fullReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
        }
        if (cleanReply !== fullVisible) {
          opt.onTrace?.({ type: 'text_cleaned_from_tags', timestamp: Date.now(), cleanedText: cleanReply });
        }
        fullVisible = cleanReply;
      }
    }

    if (reasoningStarted && !reasoningCompleted) {
      opt.eventBus.emit('reasoningComplete', fullReasoning);
      opt.eventBus.emit('thinkingEnd');
    }

    const data: any = {
      reply: fullVisible,
      reasoning: fullReasoning,
      choices: [
        {
          index: 0,
          message: {
            role: assistantRole,
            content: fullVisible,
          },
          finish_reason: 'stop',
        },
      ],
    };

    if (runFinishedEvent) {
      Object.keys(runFinishedEvent).forEach((key) => {
        if (key !== 'type' && data[key] === undefined) {
          data[key] = runFinishedEvent[key];
        }
      });
    }

    if (lastAssistantMessageId) {
      data.messageId = lastAssistantMessageId;
      data.id = lastAssistantMessageId;
    }

    const excludedKeys = ['delta', 'finish_reason', 'index', 'choices', 'message'];
    Object.keys(extraFields).forEach((key) => {
      if (!excludedKeys.includes(key) && data[key] === undefined) {
        data[key] = extraFields[key];
      }
    });

    const usageEvent = rawEvents.find((e) => e.usage);
    if (usageEvent?.usage) {
      data.usage = usageEvent.usage;
    }

    opt.onTrace?.({
      type: 'final_response',
      timestamp: Date.now(),
      responseBody: data,
    });

    return {
      data,
      replyText: fullVisible,
      reasoningText: fullReasoning,
      historySynced: historyWasSynced,
    };
  }
}
