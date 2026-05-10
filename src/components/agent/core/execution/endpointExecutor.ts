import { EventBus } from '../events/eventBus';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';
import { buildEndpointConfig } from '../config/resolver';
import { HttpClient, HttpResponse } from './httpClient';
import { handlePolling } from '../processing/helpers/polling';
import { HandlerRegistry } from '../processing/handlers/response';
import { AgentConfig, EndpointConfig, TraceStep } from '../../shared/types';
import { PostProcessingMiddleware } from '../processing/middleware/postprocessing';
import { ResolvedEndpointConfig } from '../config/types';

export class EndpointExecutor {
  constructor(
    private http: HttpClient,
    private ctx: ContextManager,
    private history: HistoryManager,
    private bus: EventBus,
    private agentConfig: AgentConfig,
    private handlerFactory: HandlerRegistry,
    private middlewares: PostProcessingMiddleware[] = []
  ) {}

  async execute(
    endpoint: EndpointConfig,
    additionalCtx: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    const context = { ...this.ctx.context, ...additionalCtx };
    const executeConfig = buildEndpointConfig(endpoint, this.agentConfig, context);
    const body = this.buildBody(executeConfig, context);

    const finalResponse = await this.executeHttpRequest(executeConfig, body, onTrace, signal);
    const handler = this.handlerFactory.get(executeConfig, finalResponse);
    const processed = await handler.handle(executeConfig, finalResponse, {
      eventBus: this.bus,
      onTrace,
      signal,
    });

    for (const mw of this.middlewares) {
      await mw.process(processed, executeConfig, context);
    }

    this.ctx.replace(context);
    return processed.data;
  }

  private async executeHttpRequest(
    resolved: ResolvedEndpointConfig,
    body: any,
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<HttpResponse> {
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

    if (!resolved.polling) {
      return httpResponse;
    }

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

    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      clone: () => undefined as any,
      text: async () => JSON.stringify(pollingData),
      json: async () => pollingData,
    };
  }

  private buildBody(resolved: ResolvedEndpointConfig, context: Record<string, any>): any {
    if (!resolved.conversationHistory) {
      return resolved.body;
    }

    this.history.addUserMessage(resolved, context);

    if (context.messages?.length) {
      return { ...resolved.body, messages: context.messages };
    }
    return resolved.body;
  }
}
