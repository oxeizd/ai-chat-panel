import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { HttpResponse } from '../httpClient';
import { extractValueByPath } from '../../shared/utils/objectHelpers';
import { STREAMING_DEFAULTS } from '../../shared/constants';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from '../response';
import { getStreamConfig, parseSSEStream, detectSSEByContent, isStreamingEnabled } from '../../shared/utils/streaming';

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

    let fullReasoning = '';
    let fullVisible = '';

    const historyCfg = typeof ep.conversationHistory === 'object' ? ep.conversationHistory : undefined;
    const historySync = historyCfg?.historySync;

    const onSync = (event: any) => {
      if (historySync && event.type === historySync.eventType) {
        const msgs = extractValueByPath(event, historySync.messagesPath);
        if (Array.isArray(msgs)) {
          ctx.messages = msgs;
          opt.onTrace?.({
            type: 'context_update',
            timestamp: Date.now(),
            contextChanges: { messages_snapshot: msgs },
          });
        }
      }
    };

    const { fullText, finalEvent, rawEvents } = await parseSSEStream(
      res as any,
      textPath,
      prefix,
      (chunk) => {
        // Обычный текстовый чанк (content)
        fullVisible += chunk;
        opt.eventBus.emit('chunk', chunk);
      },
      onSync,
      opt.onTrace,
      (rChunk) => {
        // Чанк reasoning_content (от API)
        fullReasoning += rChunk;
        opt.eventBus.emit('reasoningChunk', rChunk);
      }
    );

    if (fullReasoning) {
      opt.eventBus.emit('reasoningComplete', fullReasoning);
    }

    const data = {
      reply: fullVisible,
      result: fullVisible,
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
      replyText: fullVisible,
      reasoningText: fullReasoning,
      rawText: fullText,
      rawEvents,
    };
  }
}
