import { EventBus } from './eventBus';
import { HttpClient } from './httpClient';
import { ContextManager } from './context';
import { HistoryManager } from './history';
import { ResponseHandlerFactory } from './response';
import { EndpointConfig, TraceStep } from '../shared/types';
import { PostProcessingMiddleware } from './postproc/types';
import { mergeObjects } from '../shared/utils/objectHelpers';
import { resolveObject } from '../shared/utils/variableResolver';
import { buildUrl, buildRequestBody, extractReply } from '../shared/utils/httpHelpers';

/**
 * Исполнитель одного эндпоинта.
 * Координирует: подготовку запроса, выполнение, обработку ответа и постобработку.
 */
export class EndpointExecutor {
  constructor(
    private http: HttpClient,
    private handlerFactory: ResponseHandlerFactory,
    private ctx: ContextManager,
    private history: HistoryManager,
    private bus: EventBus,
    private middlewares: PostProcessingMiddleware[] = []
  ) {}

  /**
   * Выполнить эндпоинт.
   * @param endpoint - конфигурация
   * @param additionalCtx - дополнительный контекст (сливается с текущим)
   * @param agentConfig - глобальная конфигурация агента
   * @param agentHeaders - глобальные заголовки
   * @param onTrace - колбэк трассировки
   * @param onChunk - для совместимости (будет подписан на шину)
   * @param onReasoningChunk - для совместимости
   * @param signal - AbortSignal
   * @returns итоговые данные ответа
   */
  async execute(
    endpoint: EndpointConfig,
    additionalCtx: Record<string, any> = {},
    agentConfig?: Record<string, any>,
    agentHeaders?: Record<string, string>,
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    // 1. Формируем рабочий контекст
    const context = { ...this.ctx.context, ...additionalCtx };

    // 2. URL и тело запроса
    const url = buildUrl(endpoint, context, '');
    let { mergedBody, bodyString } = buildRequestBody(endpoint, context, agentConfig);

    // 3. История: добавляем сообщение пользователя до запроса
    this.history.addUserMessage(endpoint, context, mergedBody);

    const ch = endpoint.conversationHistory;
    const historyEnabled = ch === true ? true : ch && typeof ch === 'object' ? ch.enabled : false;

    if (historyEnabled) {
      mergedBody.messages = context.messages;
      if (Object.keys(mergedBody).length > 0) {
        bodyString = JSON.stringify(mergedBody);
      }
    }

    // 4. Заголовки
    const headers = resolveObject(mergeObjects(agentHeaders || {}, endpoint.headers || {}), context) as Record<
      string,
      string
    >;

    // 5. HTTP-запрос
    const httpResponse = await this.http.execute(
      { url: endpoint.path, method: endpoint.method, headers, body: bodyString, onTrace },
      signal
    );

    try {
      // 7. Выбор и вызов обработчика ответа
      const handler = this.handlerFactory.get(endpoint, httpResponse);
      const processed = await handler.handle(httpResponse, endpoint, context, {
        eventBus: this.bus,
        onTrace,
        signal,
        requestMeta: { url, headers, body: bodyString },
      });

      // 8. Извлечение reply, если не было сделано в обработчике
      if (!processed.replyText) {
        const { replyText } = extractReply(processed.data, endpoint.replyField);
        processed.replyText = replyText;
      }

      // 9. Цепочка постобработки (middleware)
      for (const mw of this.middlewares) {
        await mw.process(processed, endpoint, context, mergedBody);
      }

      // 10. Сохраняем итоговый контекст
      this.ctx.replace(context);

      return processed.data;
    } catch {}
  }
}
