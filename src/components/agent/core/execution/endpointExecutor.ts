import { EventBus } from '../events/eventBus';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';
import { buildEndpointConfig } from '../config/resolver';
import { HttpClient, HttpResponse } from './httpClient';
import { handlePolling } from '../processing/helpers/polling';
import { ResponseHandlerFactory } from '../processing/handlers/response';
import { AgentConfig, EndpointConfig, TraceStep } from '../../shared/types';
import { PostProcessingMiddleware } from '../processing/middleware/postprocessing';

export class EndpointExecutor {
  constructor(
    private http: HttpClient,
    private ctx: ContextManager,
    private history: HistoryManager,
    private bus: EventBus,
    private agentConfig: AgentConfig,
    private handlerFactory: ResponseHandlerFactory,
    private middlewares: PostProcessingMiddleware[] = []
  ) {}

  async execute(
    rawEndpoint: EndpointConfig,
    additionalCtx: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    const context = { ...this.ctx.context, ...additionalCtx };
    const resolved = buildEndpointConfig(rawEndpoint, this.agentConfig, context);
    console.log(resolved)
    
    let body;
    if (resolved.conversationHistory && context.messages?.length) {
      body = { ...resolved.body, messages: context.messages };
    } else {
      body = resolved.body;
    }
    
    // Теперь передаём готовый body в addUserMessage
    if (resolved.conversationHistory) {
      this.history.addUserMessage(resolved, context);
    }

    // Первый запрос
    let httpResponse = await this.http.execute(
      {
        url: resolved.url,
        method: resolved.method,
        headers: resolved.headers,
        body: JSON.stringify(body),
        onTrace,
      },
      signal
    );

    let finalResponse: HttpResponse;

    if (resolved.polling) {
      let initialData = null;
      if (httpResponse.ok) {
        try {
          initialData = await httpResponse.json();
        } catch {}
      }
      const pollingData = await handlePolling(
        resolved.polling,
        resolved.method,
        resolved.url,
        resolved.headers,
        JSON.stringify(resolved.body),
        initialData,
        onTrace,
        signal
      );
      finalResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        clone: () => finalResponse,
        text: async () => JSON.stringify(pollingData),
        json: async () => pollingData,
      };
    } else {
      finalResponse = httpResponse;
    }

    // Выбираем обработчик
    const handler = this.handlerFactory.get(resolved, finalResponse);
    const processed = await handler.handle(resolved, finalResponse, {
      eventBus: this.bus,
      onTrace,
      signal,
    });

    // Постобработка
    for (const mw of this.middlewares) {
      await mw.process(processed, resolved, context);
    }

    this.ctx.replace(context);
    console.log(this.ctx)

    return processed.data;
  }
}
