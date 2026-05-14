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

    // ----- Separate protocol (e.g., DeepSeek) -----
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
            opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now(), fullReasoning });
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
    // ----- Embedded SSE (standard) -----
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
          // Custom historySync from endpoint config
          if (historySync && event.type === historySync.eventType) {
            const msgs = extractValueByPath(event, historySync.messagesPath);
            if (Array.isArray(msgs)) {
              historyWasSynced = true;
              opt.onTrace?.({
                type: 'history_sync',
                timestamp: Date.now(),
                messagesCount: msgs.length,
              });
              opt.eventBus.emit('contextUpdate', { messages: msgs });
            }
          }
          // Fallback for MESSAGES_SNAPSHOT (when no custom historySync)
          if (!historySync && event.type === 'MESSAGES_SNAPSHOT' && Array.isArray(event.messages)) {
            historyWasSynced = true;
            opt.onTrace?.({
              type: 'history_sync',
              timestamp: Date.now(),
              messagesCount: event.messages.length,
            });
            opt.eventBus.emit('contextUpdate', { messages: event.messages });
          }
          // Capture run metadata if needed (not used for history, just available in final response)
          if (event.type === 'RUN_FINISHED') {
            finalMetadata = { threadId: event.threadId, runId: event.runId };
          }
        },
        onTrace: opt.onTrace,
      });

      fullVisible = result.fullText || fullVisible;
      finalEvent = result.finalEvent;
      rawEvents = result.rawEvents;

      // Extract metadata from rawEvents if not already captured
      if (!finalMetadata) {
        const runFinished = rawEvents.find((e) => e.type === 'RUN_FINISHED');
        if (runFinished) {
          finalMetadata = { threadId: runFinished.threadId, runId: runFinished.runId };
        }
      }

      // Handle thinking_tags mode (extract reasoning from final text)
      if (reasoning && reasoning.format === 'embedded') {
        const { reasoningText, cleanReply } = extractReasoning({ reply: fullVisible }, fullVisible, reasoning);
        if (reasoningText) {
          fullReasoning = fullReasoning ? `${fullReasoning}\n${reasoningText}` : reasoningText;
          opt.onTrace?.({ type: 'reasoning_extracted_from_tags', timestamp: Date.now(), reasoningText });
        }
        if (cleanReply !== fullVisible) {
          opt.onTrace?.({ type: 'text_cleaned_from_tags', timestamp: Date.now(), cleanedText: cleanReply });
        }
        fullVisible = cleanReply;
      }
    }

    // Finalize reasoning if started but not completed
    if (reasoningStarted && !reasoningCompleted) {
      opt.eventBus.emit('reasoningComplete', fullReasoning);
      opt.eventBus.emit('thinkingEnd');
      opt.onTrace?.({ type: 'reasoning_complete', timestamp: Date.now(), fullReasoning });
    }

    // Construct the final response object – exactly what came from the API,
    // without adding artificial 'choices', 'role', or 'content'.
    const data: any = {
      reply: fullVisible,
      result: fullVisible,
      thinking: fullReasoning,
      rawEvents: rawEvents,
    };
    if (finalMetadata) {
      data.finalMetadata = finalMetadata;
      if (finalMetadata.threadId) {
        data.threadId = finalMetadata.threadId;
      }
      if (finalMetadata.runId) {
        data.runId = finalMetadata.runId;
      }
    }
    if (finalEvent) {
      // Include any top-level fields from the final event (e.g., id, messageId)
      if (finalEvent.id) {
        data.id = finalEvent.id;
      }
      if (finalEvent.messageId) {
        data.messageId = finalEvent.messageId;
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
