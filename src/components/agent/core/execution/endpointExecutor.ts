import { ResolvedEndpointConfig } from '../config/types';
import { buildEndpointConfig } from '../config/resolver';
import { EventBus } from '../events/eventBus';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';
import { HttpClient, HttpResponse } from './httpClient';
import { handlePolling } from '../processing/helpers/polling';
import { HandlerRegistry } from '../processing/handlers/response';
import { AgentConfig, EndpointConfig, TraceStep } from '../../shared/types';
import { PostProcessingMiddleware } from '../processing/middleware/postprocessing';

export class EndpointExecutor {
  constructor(
    private httpClient: HttpClient,
    private contextManager: ContextManager,
    private historyManager: HistoryManager,
    private eventBus: EventBus,
    private agentConfig: AgentConfig,
    private handlerRegistry: HandlerRegistry,
    private postProcessingMiddlewares: PostProcessingMiddleware[] = []
  ) {}

  async execute(
    endpointConfig: EndpointConfig,
    addedContext: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    const mergedContext = { ...this.contextManager.context, ...addedContext };
    const resolvedConfig = buildEndpointConfig(endpointConfig, this.agentConfig, mergedContext);

    const requestBody = this.buildRequestBody(resolvedConfig, mergedContext);
    const httpResponse = await this.performHttpRequest(resolvedConfig, requestBody, onTrace, signal);
    const responseHandler = this.handlerRegistry.get(resolvedConfig, httpResponse);

    const handledResult = await responseHandler.handle(resolvedConfig, httpResponse, {
      eventBus: this.eventBus,
      onTrace,
      signal,
    });

    for (const middleware of this.postProcessingMiddlewares) {
      await middleware.process(handledResult, resolvedConfig, mergedContext);
    }

    const finalContext = { ...mergedContext, ...this.contextManager.context };
    this.contextManager.replace(finalContext);
    return handledResult.data;
  }

  private async performHttpRequest(
    resolved: ResolvedEndpointConfig,
    body: any,
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<HttpResponse> {
    const methodUpper = resolved.method.toUpperCase();
    const bodyAllowed = !['GET', 'HEAD'].includes(methodUpper);
    const serializedBody = bodyAllowed && body !== undefined && body !== null ? JSON.stringify(body) : undefined;

    let response = await this.httpClient.execute(
      {
        url: resolved.url,
        method: resolved.method,
        headers: resolved.headers,
        body: serializedBody,
        onTrace,
      },
      signal
    );

    if (!resolved.polling) {
      return response;
    }

    let initialResponseData = null;

    if (response.ok) {
      try {
        initialResponseData = await response.json();
      } catch {}
    }

    const pollingResult = await handlePolling(
      resolved.polling,
      resolved.method,
      resolved.url,
      resolved.headers,
      JSON.stringify(resolved.body),
      initialResponseData,
      onTrace,
      signal
    );

    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      clone: () => undefined as any,
      text: async () => JSON.stringify(pollingResult),
      json: async () => pollingResult,
    };
  }

  private buildRequestBody(resolved: ResolvedEndpointConfig, context: Record<string, any>): any {
    if (!resolved.conversationHistory) {
      return resolved.body;
    }

    this.historyManager.addUserMessage(resolved, context);

    if (context.messages?.length) {
      return { ...resolved.body, messages: context.messages };
    }
    return resolved.body;
  }
}
