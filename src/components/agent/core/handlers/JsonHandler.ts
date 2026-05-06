import { IResponseHandler, ProcessedResponse, HandlerOptions } from '../../interfaces/IResponseHandler';
import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../core/ContextManager';
import { HttpResponse } from '../../interfaces/IHttpClient';
import { detectSSEByContent } from '../../utils/streaming';
import { isStreamingEnabled } from '../../utils/streaming';

/**
 * Обработчик обычных JSON-ответов.
 */
export class JsonHandler implements IResponseHandler {
  /**
   * Проверяет, что ответ не SSE и стриминг не включён в конфиге.
   */
  canHandle(endpoint: EndpointConfig, response: HttpResponse): boolean {
    // Не обрабатываем SSE
    return !detectSSEByContent(response as any) && !isStreamingEnabled(endpoint);
  }

  /**
   * Парсит JSON, проверяет наличие ошибки API.
   * @returns ProcessedResponse с полем data
   */
  async handle(
    response: HttpResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    options?: HandlerOptions
  ): Promise<ProcessedResponse> {
    const data = await response.json();

    if (data?.error) {
      const err: any = new Error(data.error.message || 'API error');
      err.status = data.error.code || data.error.status || response.status;
      err.responseBody = JSON.stringify(data.error);
      throw err;
    }

    if (options?.onTrace) {
      options.onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: response.status,
        responseBody: data,
      });
    }

    return { data };
  }
}