import { AgentConfig, EndpointConfig, TraceStep } from '../shared/types';
import { HttpClient } from './httpClient';
import { ResponseHandlerFactory } from './processing/handlers/response';
import { EndpointExecutor } from './endpointExecutor';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';
import { EventBus } from './eventBus';
import { extractReply } from '../shared/utils/httpHelpers';
import {
  ContextSaveMiddleware,
  FileExtractionMiddleware,
  HistoryMiddleware,
} from './processing/middleware/postprocessing';

/**
 * Публичный клиент агента – основной API.
 * Сохраняет обратную совместимость с предыдущей версией.
 */
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

    const http = new HttpClient(config.api);
    const factory = new ResponseHandlerFactory();

    const mids = [new HistoryMiddleware(this.history), new ContextSaveMiddleware(), new FileExtractionMiddleware()];

    this.executor = new EndpointExecutor(http, factory, this.ctx, this.history, this.bus, mids);
  }

  //Публичная подписка на события шины
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

  // ─── Управление сессией ─────────────────────────────────
  async resetSession(): Promise<void> {
    if (this.processing) {
      throw new Error('Cannot reset while processing');
    }
    this.bus.clear();
    this.ctx.reset();
    this.history.reset(this.ctx.context);
    this.initialized = false;
    if (this.config.startupOperation && this.config.endpoints) {
      const ep = this.config.endpoints.find((e) => e.operation === this.config.startupOperation);
      if (ep) {
        await this.executor.execute(ep, {}, this.config.config, this.config.headers);
      }
      this.initialized = true;
    }
  }

  // ─── Отправка сообщения (совместимость) ────────────────
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

      // Стартовая операция
      if (this.config.startupOperation && !this.initialized) {
        const ep = this.config.endpoints.find((e) => e.operation === this.config.startupOperation);
        if (!ep) {
          throw new Error(`Startup operation "${this.config.startupOperation}" not found`);
        }
        await this.executor.execute(ep, {}, this.config.config, this.config.headers, onTrace, signal);
        this.initialized = true;
      }

      // Workflow – теперь без оркестратора
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
          last = await this.executor.execute(
            step.endpoint,
            {},
            this.config.config,
            this.config.headers,
            onTrace,
            signal
          );
        }
        return last.reply || last.result || JSON.stringify(last);
      }

      // fallback, если workflow нет
      const fallbackEndpoint: EndpointConfig = {
        operation: 'fallback',
        method: 'POST',
        path: '/',
        body: { message: '{user_input}' },
        headers: { 'Content-Type': 'application/json' },
        saveToContext: [],
      };

      const processed = await this.executor.execute(
        fallbackEndpoint,
        {},
        this.config.config,
        this.config.headers,
        onTrace,
        signal
      );

      const { replyText } = extractReply(processed);
      return replyText || 'Ответ не получен';
    } finally {
      this.processing = false;
    }
  }
}
