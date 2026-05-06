import { IResponseHandler, ProcessedResponse, HandlerOptions } from '../../interfaces/IResponseHandler';
import { EndpointConfig } from '../../types';
import { WorkflowContext } from '../../core/ContextManager';
import { HttpResponse } from '../../interfaces/IHttpClient';
import { handlePolling } from '../../utils/polling';

/**
 * Декоратор, добавляющий поллинг поверх другого обработчика.
 */
export class PollingHandler implements IResponseHandler {
  constructor(private innerHandler: IResponseHandler) {}

  /**
   * Polling применим, если endpoint содержит polling.enabled.
   */
  canHandle(endpoint: EndpointConfig, response: HttpResponse): boolean {
    return !!endpoint.polling?.enabled;
  }

  /**
   * Сначала получает ответ через innerHandler, затем запускает поллинг.
   */
  async handle(
    response: HttpResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    options?: HandlerOptions
  ): Promise<ProcessedResponse> {
    // Первичный ответ через внутренний обработчик
    const initial = await this.innerHandler.handle(response, endpoint, context, options);
    if (!endpoint.polling?.enabled) return initial;

    // Параметры запроса (URL, заголовки, тело) для последующих запросов поллинга
    const meta = options?.requestMeta;
    if (!meta) throw new Error('Polling requires requestMeta in options');

    let data = initial.data;

    data = await handlePolling(
      { ...endpoint, method: endpoint.method },
      meta.url,
      meta.headers,
      meta.body,
      data,
      options?.onTrace
    );

    return { ...initial, data };
  }
}