import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { HttpClient } from './core/HttpClient';
import { ResponseHandlerFactory } from './core/ResponseHandlerFactory';
import { PollingHandler } from './core/handlers/PollingHandler';
import { JsonHandler } from './core/handlers/JsonHandler';
import { EndpointExecutor } from './core/EndpointExecutor';
import { WorkflowOrchestrator } from './core/WorkflowOrchestrator';
import { ContextManager } from './core/ContextManager';
import { HistoryManager } from './core/HistoryManager';
import { HistoryMiddleware } from './core/middleware/HistoryMiddleware';
import { ContextSaveMiddleware } from './core/middleware/ContextSaveMiddleware';
import { FileExtractionMiddleware } from './core/middleware/FileExtractionMiddleware';
import { resolveObject } from './utils/variableResolver';

/**
 * Основной клиент агента. Сохраняет обратную совместимость со старым API.
 */
export class AgentClient {
  private config: AgentConfig;
  private contextManager: ContextManager;
  private historyManager: HistoryManager;
  private executor: EndpointExecutor;
  private orchestrator: WorkflowOrchestrator;
  private initialized = false;
  private isProcessing = false;

  /**
   * @param config - конфигурация агента
   */
  constructor(config: AgentConfig) {
    this.config = config;

    // Транспортный слой
    const httpClient = new HttpClient(config.api);

    // Фабрика обработчиков ответов
    const handlerFactory = new ResponseHandlerFactory();

    // Регистрируем polling-обработчик (декоратор над JSON). В реальном коде можно добавить логику выбора innerHandler в зависимости от типа ответа.
    const pollingHandler = new PollingHandler(new JsonHandler());
    handlerFactory.registerHandler(pollingHandler);

    // Менеджеры состояния
    this.contextManager = new ContextManager();
    this.historyManager = new HistoryManager();

    // Цепочка постобработки
    const middlewares = [
      new HistoryMiddleware(this.historyManager),
      new ContextSaveMiddleware(),
      new FileExtractionMiddleware(),
    ];

    // Исполнитель одного эндпоинта
    this.executor = new EndpointExecutor(
      httpClient,
      handlerFactory,
      this.contextManager,
      this.historyManager,
      middlewares
    );

    // Оркестратор workflow
    this.orchestrator = new WorkflowOrchestrator(this.executor);
  }

  /**
   * Сброс сессии: очистка контекста и выполнение стартовой операции, если задана.
   */
  async resetSession(): Promise<void> {
    if (this.isProcessing) throw new Error('Cannot reset session while processing');
    this.contextManager.reset();
    this.initialized = false;
    if (this.config.startupOperation && this.config.endpoints) {
      const endpoint = this.config.endpoints.find(ep => ep.operation === this.config.startupOperation);
      if (endpoint) {
        await this.executor.execute(endpoint, {}, this.config.config, this.config.headers);
        this.initialized = true;
      }
    }
  }

  /**
   * Отправка сообщения пользователя и получение ответа.
   * @param userInput - текст пользователя
   * @param additionalContext - дополнительные данные контекста
   * @param onTrace - колбэк трассировки
   * @param onChunk - колбэк для чанков (при стриминге)
   * @param signal - AbortSignal
   * @returns строка ответа
   */
  async sendMessage(
    userInput: string,
    additionalContext: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (this.isProcessing) throw new Error('Agent is already processing a message');
    this.isProcessing = true;
    try {
      this.contextManager.set('user_input', userInput);
      this.contextManager.update(additionalContext);

      // 1. Стартовая операция, если ещё не выполнена
      if (this.config.startupOperation && !this.initialized) {
        const epMap = new Map(this.config.endpoints.map(ep => [ep.operation, ep]));
        const startupEp = epMap.get(this.config.startupOperation);
        if (!startupEp) throw new Error(`Startup operation "${this.config.startupOperation}" not found`);
        await this.executor.execute(startupEp, {}, this.config.config, this.config.headers, onTrace, undefined, signal);
        this.initialized = true;
      }

      // 2. Если задан workflow из эндпоинтов — выполняем
      if (this.config.endpoints?.length && this.config.workflow?.length) {
        const epMap = new Map(this.config.endpoints.map(ep => [ep.operation, ep]));
        const steps = this.config.workflow
          .filter(op => op !== this.config.startupOperation)
          .map(op => {
            const ep = epMap.get(op);
            if (!ep) {
              console.warn(`Operation "${op}" not found in endpoints, skipping`);
              return null;
            }
            return { endpoint: ep };
          })
          .filter((s): s is { endpoint: EndpointConfig } => s !== null);

        if (steps.length === 0) throw new Error('No valid steps in workflow');

        const lastResponse = await this.orchestrator.execute(
          steps,
          {},
          this.config.config,
          this.config.headers,
          onTrace,
          onChunk,
          signal
        );
        return lastResponse.reply || lastResponse.result || JSON.stringify(lastResponse);
      }

      // 3. Fallback — прямой запрос (для простоты сохраняем старую логику, но лучше реализовать через executor)
      let requestBody: any = { message: userInput };
      if (this.config.config) {
        const resolvedConfig = resolveObject(this.config.config, this.contextManager.context);
        requestBody = { ...requestBody, ...resolvedConfig };
      }

      const headersObj: Record<string, string> = {};
      if (this.config.headers) {
        const resolvedHeaders = resolveObject(this.config.headers, this.contextManager.context);
        for (const [k, v] of Object.entries(resolvedHeaders)) {
          headersObj[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
      if (!headersObj['Content-Type'] && !headersObj['content-type']) {
        headersObj['Content-Type'] = 'application/json';
      }

      if (onTrace) {
        onTrace({
          type: 'request',
          timestamp: Date.now(),
          url: this.config.api,
          method: 'POST',
          requestBody,
        });
      }

      const response = await fetch(this.config.api, {
        method: 'POST',
        headers: headersObj,
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorText = '';
        try { errorText = await response.text(); } catch {}
        if (onTrace) {
          onTrace({ type: 'response', timestamp: Date.now(), responseStatus: response.status, responseBody: errorText });
        }
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const responseData = await response.json();
      if (responseData?.error) {
        const err: any = new Error(responseData.error.message || 'API error');
        err.status = responseData.error.code || responseData.error.status || response.status;
        err.responseBody = JSON.stringify(responseData.error);
        throw err;
      }

      if (onTrace) {
        onTrace({ type: 'response', timestamp: Date.now(), responseStatus: response.status, responseBody: responseData });
      }
      return responseData.reply || responseData.result || 'Ответ не получен';
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error('Request was cancelled');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
}