import { EndpointConfig, TraceStep } from 'types';
import { IHttpClient } from '../interfaces/IHttpClient';
import { ResponseHandlerFactory } from './ResponseHandlerFactory';
import { ContextManager } from './ContextManager';
import { HistoryManager } from './HistoryManager';
import { IPostProcessingMiddleware } from '../interfaces/IPostProcessingMiddleware';
import { buildUrl, buildRequestBody, extractReply } from '../utils/httpHelpers';
import { mergeObjects } from '../utils/objectHelpers';
import { resolveObject } from '../utils/variableResolver';

/**
 * Исполнитель одного эндпоинта.
 * Координирует подготовку запроса, его выполнение, обработку ответа и постобработку.
 */
export class EndpointExecutor {
  constructor(
    private httpClient: IHttpClient,
    private handlerFactory: ResponseHandlerFactory,
    private contextManager: ContextManager,
    private historyManager: HistoryManager,
    private middlewares: IPostProcessingMiddleware[] = []
  ) {}

  /**
   * Выполнить эндпоинт.
   * @param endpoint - конфигурация
   * @param additionalContext - дополнительный контекст (объединяется с текущим)
   * @param agentConfig - глобальная конфигурация агента
   * @param agentHeaders - глобальные заголовки
   * @param onTrace - колбэк трассировки
   * @param onChunk - колбэк для чанков стриминга
   * @param signal - AbortSignal для отмены
   * @returns итоговые данные ответа
   */
  async execute(
    endpoint: EndpointConfig,
    additionalContext: Record<string, any> = {},
    agentConfig?: Record<string, any>,
    agentHeaders?: Record<string, string>,
    onTrace?: (step: TraceStep) => void,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<any> {
    // Текущий контекст + дополнительный
    const context = { ...this.contextManager.context, ...additionalContext };

    // ---- 1. Построение URL и тела запроса ----
    const url = buildUrl(endpoint, context, ''); // базовый URL уже в HttpClient
    let { mergedBody, bodyString } = buildRequestBody(endpoint, context, agentConfig);

    // ---- 2. Добавление сообщения пользователя в историю ----
    this.historyManager.addUserMessage(endpoint, context, mergedBody);
    // Если сохраняем историю, вставляем messages из контекста в тело
    if (endpoint.preserveConversationHistory) {
      mergedBody.messages = context.messages;
      if (Object.keys(mergedBody).length > 0) {
        bodyString = JSON.stringify(mergedBody);
      }
    }

    // ---- 3. Заголовки ----
    const mergedHeaders = mergeObjects(agentHeaders || {}, endpoint.headers || {});
    const resolvedHeaders = resolveObject(mergedHeaders, context);

    // ---- 4. Выполнение HTTP-запроса ----
    const httpResponse = await this.httpClient.execute(
      {
        url: endpoint.path, // HttpClient добавит базовый
        method: endpoint.method,
        headers: resolvedHeaders as Record<string, string>,
        body: bodyString,
        onTrace,
      },
      signal
    );

    // ---- 5. Выбор обработчика ответа и обработка ----
    const handler = this.handlerFactory.getHandler(endpoint, httpResponse);
    const processedResponse = await handler.handle(httpResponse, endpoint, context, {
      onChunk,
      onTrace,
      signal,
      requestMeta: { url, headers: resolvedHeaders as Record<string, string>, body: bodyString },
    });

    // ---- 6. Извлечение reply, если не был извлечён внутри обработчика ----
    if (!processedResponse.replyText) {
      const { replyText } = extractReply(processedResponse.data, endpoint.replyField);
      processedResponse.replyText = replyText;
    }

    // ---- 7. Пропуск через цепочку middleware ----
    for (const mw of this.middlewares) {
      await mw.process(processedResponse, endpoint, context, mergedBody);
    }

    // ---- 8. Сохранение контекста ----
    this.contextManager.replace(context);

    // ---- 9. Возврат итоговых данных ----
    return processedResponse.data;
  }
}