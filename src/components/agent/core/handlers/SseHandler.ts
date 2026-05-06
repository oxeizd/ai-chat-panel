import { IResponseHandler, ProcessedResponse, HandlerOptions } from '../../interfaces/IResponseHandler';
import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../core/ContextManager';
import { HttpResponse } from '../../interfaces/IHttpClient';
import { getStreamConfig, parseSSEStream, detectSSEByContent, isStreamingEnabled } from '../../utils/streaming';
import { STREAMING_DEFAULTS } from '../../constants';
import { extractValueByPath } from '../../utils/objectHelpers';

/**
 * Обработчик потоковых ответов (SSE).
 * Разбирает поток, извлекает текст, поддерживает historySync.
 */
export class SseHandler implements IResponseHandler {
  canHandle(endpoint: EndpointConfig, response: HttpResponse): boolean {
    return isStreamingEnabled(endpoint) || detectSSEByContent(response as any);
  }

  async handle(
    response: HttpResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    options?: HandlerOptions
  ): Promise<ProcessedResponse> {
    if (!response.body) {
      throw new Error('SSE response must have a body');
    }

    const streamConfig = getStreamConfig(endpoint);
    const textPath = streamConfig?.textPath ?? STREAMING_DEFAULTS.textPath;
    const dataPrefix = streamConfig?.dataPrefix ?? STREAMING_DEFAULTS.dataPrefix;

    // Колбэк для событий синхронизации истории
    const onHistorySync = (event: any) => {
      if (endpoint.historySync && event.type === endpoint.historySync.eventType) {
        const snapshotMessages = extractValueByPath(event, endpoint.historySync.messagesPath);
        if (Array.isArray(snapshotMessages)) {
          context.messages = snapshotMessages;
          options?.onTrace?.({
            type: 'context_update',
            timestamp: Date.now(),
            contextChanges: { messages_snapshot: snapshotMessages },
          });
        }
      }
    };

    // Используем старую функцию парсинга SSE
    const { fullText, finalEvent, rawEvents } = await parseSSEStream(
      response as unknown as Response,
      textPath,
      dataPrefix,
      options?.onChunk,
      onHistorySync,
      options?.onTrace
    );

    const data = {
      reply: fullText,
      result: fullText,
      finalMetadata: finalEvent,
      rawEvents,
    };

    if (options?.onTrace) {
      options.onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: response.status,
        responseBody: data,
      });
    }

    return {
      data,
      replyText: fullText,
      rawText: fullText,
      rawEvents,
      // Мы не передаём syncedFromSnapshot, но он обработан в контексте
    };
  }
}