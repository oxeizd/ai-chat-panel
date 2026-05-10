import { EventBus } from './events/eventBus';
import {
  ContextSaveMiddleware,
  FileExtractionMiddleware,
  HistoryMiddleware,
} from './processing/middleware/postprocessing';
import { HttpClient } from './execution/httpClient';
import { ContextManager } from './execution/contextManager';
import { HistoryManager } from './execution/historyManager';
import { EndpointExecutor } from './execution/endpointExecutor';
import { SseHandler } from './processing/handlers/sse';
import { JsonHandler } from './processing/handlers/json';
import { extractReply } from '../shared/utils/httpHelpers';
import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { ResponseHandlerFactory, ResponseHandler } from './processing/handlers/response';

export class AgentClient {
  private config: AgentConfig;
  private ctx = new ContextManager();
  private history = new HistoryManager();
  private bus = new EventBus();
  private executor: EndpointExecutor;
  private initialized = false;
  private processing = false;

  constructor(config: AgentConfig) {
    this.config = config;
    const http = new HttpClient();
    const handlers: ResponseHandler[] = [new SseHandler(), new JsonHandler()];
    const factory = new ResponseHandlerFactory(handlers);
    const mids = [new HistoryMiddleware(this.history), new ContextSaveMiddleware(), new FileExtractionMiddleware()];
    
    this.bus.on('contextUpdate', (update: any) => {
        if (update.messages) {
            this.ctx.update({ messages: update.messages });
        }
    });
    
    this.executor = new EndpointExecutor(http, this.ctx, this.history, this.bus, this.config, factory, mids);
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
    return this.ctx.context[key];
  }

  getContext(): Record<string, any> {
    return { ...this.ctx.context };
  }

  async resetSession(): Promise<void> {
    if (this.processing) {
      throw new Error('Cannot reset while processing');
    }
    this.bus.clear();
    this.ctx.reset();
    this.initialized = false;
    if (this.config.startupOperation && this.config.endpoints) {
      const ep = this.config.endpoints.find((e) => e.operation === this.config.startupOperation);
      if (ep) {
        await this.executor.execute(ep, {}, undefined, undefined);
      }
      this.initialized = true;
    }
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
      this.ctx.set('user_input', userInput);
      this.ctx.update(additionalCtx);

      if (this.config.startupOperation && !this.initialized) {
        const ep = this.config.endpoints.find((e) => e.operation === this.config.startupOperation);
        if (!ep) {
          throw new Error(`Startup operation "${this.config.startupOperation}" not found`);
        }
        await this.executor.execute(ep, {}, onTrace, signal);
        this.initialized = true;
      }

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

      // fallback
      const fallbackEndpoint: EndpointConfig = {
        operation: 'fallback',
        method: 'POST',
        path: '/',
        body: { message: '{user_input}' },
        headers: { 'Content-Type': 'application/json' },
        saveToContext: [],
      };
      const processed = await this.executor.execute(fallbackEndpoint, {}, onTrace, signal);
      const { replyText } = extractReply(processed);
      return replyText || 'Ответ не получен';
    } finally {
      this.processing = false;
    }
  }
}
