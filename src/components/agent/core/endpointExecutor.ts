import { EventBus } from './eventBus';
import { HttpClient } from './httpClient';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';
import { ResponseHandlerFactory } from './processing/handlers/response';
import { EndpointConfig, TraceStep } from '../shared/types';
import { PostProcessingMiddleware } from './processing/middleware/postprocessing';
import { mergeObjects } from '../shared/utils/objectHelpers';
import { resolveObject } from '../shared/utils/variableResolver';
import { buildUrl, buildRequestBody, extractReply } from '../shared/utils/httpHelpers';
import { handlePolling } from './processing/helpers/polling';

export class EndpointExecutor {
  constructor(
    private http: HttpClient,
    private handlerFactory: ResponseHandlerFactory,
    private ctx: ContextManager,
    private history: HistoryManager,
    private bus: EventBus,
    private middlewares: PostProcessingMiddleware[] = []
  ) {}

  async execute(
    endpoint: EndpointConfig,
    additionalCtx: Record<string, any> = {},
    agentConfig?: Record<string, any>,
    agentHeaders?: Record<string, string>,
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    const context = { ...this.ctx.context, ...additionalCtx };

    const url = buildUrl(endpoint, context, '');
    let { mergedBody, bodyString } = buildRequestBody(endpoint, context, agentConfig);

    this.history.addUserMessage(endpoint, context, mergedBody);

    const ch = endpoint.conversationHistory;
    const historyEnabled = ch === true ? true : ch && typeof ch === 'object' ? ch.enabled : false;

    if (historyEnabled) {
      mergedBody.messages = context.messages;
      if (Object.keys(mergedBody).length > 0) {
        bodyString = JSON.stringify(mergedBody);
      }
    }

    const headers = resolveObject(mergeObjects(agentHeaders || {}, endpoint.headers || {}), context) as Record<
      string,
      string
    >;

    // Первый запрос
    let httpResponse = await this.http.execute(
      { url: endpoint.path, method: endpoint.method, headers, body: bodyString, onTrace },
      signal
    );

    // Поллинг (если включён)
    let finalResponse = httpResponse;
    if (endpoint.polling?.enabled) {
      let firstData = null;
      if (httpResponse.ok) {
        try {
          firstData = await httpResponse.json();
        } catch {
          // первый ответ может быть не JSON — игнорируем
        }
      }
      const pollingData = await handlePolling(endpoint, url, headers, bodyString, firstData, onTrace, signal);
      // Создаём поддельный HttpResponse с результатом поллинга
      finalResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        clone: () => finalResponse,
        text: async () => JSON.stringify(pollingData),
        json: async () => pollingData,
      };
    }

    // Обработка ответа (теперь всегда через finalResponse)
    const handler = this.handlerFactory.get(endpoint, finalResponse);
    const processed = await handler.handle(finalResponse, endpoint, context, {
      eventBus: this.bus,
      onTrace,
      signal,
      requestMeta: { url, headers, body: bodyString },
    });

    if (!processed.replyText) {
      const { replyText } = extractReply(processed.data, endpoint.replyField);
      processed.replyText = replyText;
    }

    for (const mw of this.middlewares) {
      await mw.process(processed, endpoint, context, mergedBody);
    }

    this.ctx.replace(context);
    return processed.data;
  }
}
