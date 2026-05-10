import { EventBus } from './events/eventBus';
import { HttpClient } from './execution/httpClient';
import { ContextManager } from './execution/contextManager';
import { HistoryManager } from './execution/historyManager';
import { EndpointExecutor } from './execution/endpointExecutor';
import { SseHandler } from './processing/handlers/sse';
import { JsonHandler } from './processing/handlers/json';
import { extractReply } from '../shared/utils/httpHelpers';
import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { HandlerRegistry, ResponseHandler } from './processing/handlers/response';
import {
  ContextSaveMiddleware,
  FileExtractionMiddleware,
  HistoryMiddleware,
} from './processing/middleware/postprocessing';

export class AgentClient {
  private config: AgentConfig;
  private context = new ContextManager();
  private history = new HistoryManager();
  private bus = new EventBus();
  private executor: EndpointExecutor;
  private initialized = false;
  private processing = false;

  constructor(config: AgentConfig) {
    this.config = config;
    const http = new HttpClient();
    const handlers: ResponseHandler[] = [new SseHandler(), new JsonHandler()];
    const registry = new HandlerRegistry(handlers);
    const mids = [new HistoryMiddleware(this.history), new ContextSaveMiddleware(), new FileExtractionMiddleware()];

    this.bus.on('contextUpdate', (update: any) => {
      if (update.messages) {
        this.context.update({ messages: update.messages });
      }
    });

    this.executor = new EndpointExecutor(http, this.context, this.history, this.bus, this.config, registry, mids);
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    return this.bus.on(event, handler);
  }

  onChunk(handler: (chunk: string) => void): () => void {
    return this.on('chunk', handler);
  }

  onReasoningChunk(handler: (chunk: string) => void): () => void {
    return this.on('reasoningChunk', handler);
  }

  onReasoningComplete(handler: (text: string) => void): () => void {
    return this.on('reasoningComplete', handler);
  }

  onThinkingStart(handler: () => void): () => void {
    return this.on('thinkingStart', handler);
  }

  onThinkingEnd(handler: () => void): () => void {
    return this.on('thinkingEnd', handler);
  }

  getContextValue(key: string): any {
    return this.context.context[key];
  }

  getContext(): Record<string, any> {
    return { ...this.context.context };
  }

  async initSession(signal?: AbortSignal): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startupOp = this.config.startupOperation;
    if (!startupOp) {
      this.initialized = true;
      return;
    }

    const endpoint = this.config.endpoints.find((e) => e.operation === startupOp);

    if (!endpoint) {
      throw new Error(`Startup operation "${startupOp}" not found`);
    }

    await this.executor.execute(endpoint, {}, undefined, signal);
    this.initialized = true;
  }

  async resetSession(): Promise<void> {
    if (this.processing) {
      throw new Error('Cannot reset while processing');
    }
    this.bus.clear();
    this.context.reset();
    this.initialized = false;
    await this.initSession();
  }

  async sendMessage(
    userInput: string,
    additionalCtx: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (this.processing) {
      throw new Error('Agent is already processing');
    }

    this.processing = true;

    try {
      await this.initSession(signal);

      this.context.set('user_input', userInput);
      this.context.update(additionalCtx);

      if (this.config.endpoints?.length && this.config.workflow?.length) {
        const epMap = new Map(this.config.endpoints.map((e) => [e.operation, e]));
        const steps = this.config.workflow
          .filter((op) => op !== this.config.startupOperation)
          .map((op) => epMap.get(op))
          .filter((ep): ep is EndpointConfig => !!ep)
          .map((endpoint) => ({ endpoint }));

        if (steps.length === 0) {
          throw new Error('No valid steps in workflow');
        }

        let last: any = null;

        for (const step of steps) {
          last = await this.executor.execute(step.endpoint, {}, onTrace, signal);
        }

        return last.reply || last.result || JSON.stringify(last);
      }
      return this.executeFallback(onTrace, signal);
    } finally {
      this.processing = false;
    }
  }

  private async executeFallback(onTrace?: (step: TraceStep) => void, signal?: AbortSignal): Promise<string> {
    const fallbackEndpoint: EndpointConfig = {
      operation: 'fallback',
      method: 'POST',
      path: '/',
      body: { message: '{user_input}' },
      headers: { 'Content-Type': 'application/json' },
      saveToContext: [],
    };

    const aiResponse = await this.executor.execute(fallbackEndpoint, {}, onTrace, signal);

    const { replyText } = extractReply(aiResponse);

    return replyText || 'Ответ не получен';
  }
}
