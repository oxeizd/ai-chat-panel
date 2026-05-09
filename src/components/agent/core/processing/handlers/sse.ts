import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../contextManager';
import { HttpResponse } from '../../httpClient';
import { extractValueByPath } from 'components/agent/shared/utils/objectHelpers';
import { STREAMING_DEFAULTS } from 'components/agent/shared/constants';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from './response';
import { getStreamConfig, parseSSEStream, detectSSEByContent, isStreamingEnabled } from '../helpers/streaming';
import { getReasoningConfig } from '../helpers/reasoning';

export class SseHandler implements ResponseHandler {
  canHandle(ep: EndpointConfig, res: HttpResponse): boolean {
    return isStreamingEnabled(ep) || detectSSEByContent(res as any);
  }

  async handle(
    res: HttpResponse,
    ep: EndpointConfig,
    ctx: WorkflowContext,
    opt: HandlerOptions
  ): Promise<ProcessedResponse> {
    if (!res.body) {
      throw new Error('SSE response must have a body');
    }

    const cfg = getStreamConfig(ep);
    const textPath = cfg?.textPath ?? STREAMING_DEFAULTS.textPath;
    const prefix = cfg?.dataPrefix ?? STREAMING_DEFAULTS.dataPrefix;

    const reasoningCfg = getReasoningConfig(ep);
    const reasoningEnabled = reasoningCfg.enabled;
    const mode = reasoningCfg.mode ?? 'both';
    const useApiField = mode === 'api_field' || mode === 'both';
    const useThinkingTags = mode === 'thinking_tags' || mode === 'both';

    let fullReasoning = '';
    let fullVisible = '';
    let thinkingStarted = false;

    const historyCfg = typeof ep.conversationHistory === 'object' ? ep.conversationHistory : undefined;
    const historySync = historyCfg?.historySync;
    let historyWasSynced = false;

    const onSync = (event: any) => {
      if (historySync && event.type === historySync.eventType) {
        const msgs = extractValueByPath(event, historySync.messagesPath);
        if (Array.isArray(msgs)) {
          ctx.messages = msgs;
          historyWasSynced = true;
          opt.onTrace?.({
            type: 'context_update',
            timestamp: Date.now(),
            contextChanges: { messages_snapshot: msgs },
          });
        }
      }
    };

    let fullText = '';
    let finalEvent: any;
    let rawEvents: any[] = [];

    try {
      const result = await parseSSEStream(res as any, {
        textPath,
        dataPrefix: prefix,
        reasoningApiField: useApiField ? reasoningCfg.apiField : undefined,
        onChunk: (chunk) => {
          if (reasoningEnabled && useThinkingTags) {
            const startMarker = reasoningCfg.startMarker ?? '<thinking>';
            const endMarker = reasoningCfg.endMarker ?? '</thinking>';

            let reasoning = '';
            let visible = chunk;

            if (thinkingStarted) {
              const endIdx = visible.indexOf(endMarker);
              if (endIdx !== -1) {
                reasoning = visible.substring(0, endIdx);
                visible = visible.substring(endIdx + endMarker.length);
                thinkingStarted = false;
                opt.eventBus.emit('thinkingEnd');
                opt.eventBus.emit('reasoningComplete', fullReasoning + reasoning);
              } else {
                reasoning = visible;
                visible = '';
              }
            } else {
              const startIdx = visible.indexOf(startMarker);
              if (startIdx !== -1) {
                const beforeTag = visible.substring(0, startIdx);
                const afterStart = visible.substring(startIdx + startMarker.length);

                const endIdx = afterStart.indexOf(endMarker);
                if (endIdx !== -1) {
                  reasoning = afterStart.substring(0, endIdx);
                  visible = beforeTag + afterStart.substring(endIdx + endMarker.length);
                  opt.eventBus.emit('thinkingStart');
                  opt.eventBus.emit('reasoningChunk', reasoning);
                  opt.eventBus.emit('thinkingEnd');
                  opt.eventBus.emit('reasoningComplete', fullReasoning + reasoning);
                  fullReasoning += reasoning;
                } else {
                  reasoning = afterStart;
                  visible = beforeTag;
                  thinkingStarted = true;
                  opt.eventBus.emit('thinkingStart');
                }
              }
            }

            if (reasoning && thinkingStarted) {
              fullReasoning += reasoning;
              opt.eventBus.emit('reasoningChunk', reasoning);
            }
            if (visible) {
              fullVisible += visible;
              opt.eventBus.emit('chunk', visible);
            }
          } else {
            fullVisible += chunk;
            opt.eventBus.emit('chunk', chunk);
          }
        },
        onHistorySync: onSync,
        onTrace: opt.onTrace,
        onReasoningChunk: (rChunk) => {
          if (reasoningEnabled && useApiField) {
            if (!thinkingStarted) {
              thinkingStarted = true;
              opt.eventBus.emit('thinkingStart');
            }
            fullReasoning += rChunk;
            opt.eventBus.emit('reasoningChunk', rChunk);
          }
        },
      });

      fullText = result.fullText;
      finalEvent = result.finalEvent;
      rawEvents = result.rawEvents;
    } finally {
      if (thinkingStarted) {
        opt.eventBus.emit('thinkingEnd');
        opt.eventBus.emit('reasoningComplete', fullReasoning);
        thinkingStarted = false;
      }
    }

    const data = {
      reply: fullVisible || fullText,
      result: fullVisible || fullText,
      thinking: fullReasoning,
      finalMetadata: finalEvent,
      rawEvents,
    };

    opt.onTrace?.({
      type: 'response',
      timestamp: Date.now(),
      responseStatus: res.status,
      responseBody: data,
    });

    return {
      data,
      replyText: fullVisible || fullText,
      reasoningText: fullReasoning,
      rawText: fullText,
      rawEvents,
      historySynced: historyWasSynced,
    };
  }
}
