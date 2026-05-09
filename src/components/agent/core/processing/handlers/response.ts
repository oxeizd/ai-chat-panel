import { EndpointConfig, TraceStep } from '../../../shared/types';
import { HttpResponse } from '../../httpClient';
import { WorkflowContext } from '../../contextManager';
import { EventBus } from '../../eventBus';
import { SseHandler } from './sse';
import { JsonHandler } from './json';

/**
 * Дополнительные опции, передаваемые в обработчик ответа.
 */
export interface HandlerOptions {
  eventBus: EventBus;
  onTrace?: (step: TraceStep) => void;
  signal?: AbortSignal;
  requestMeta?: {
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
}

/**
 * Результат обработки ответа любым обработчиком.
 */
export interface ProcessedResponse {
  data: any; // итоговые данные
  replyText?: string; // извлечённый текст ответа
  reasoningText?: string; // полный текст рассуждений (если есть)
  rawText?: string; // полный сырой текст (для SSE)
  rawEvents?: any[]; // все события SSE
  historySynced?: boolean;
}

/**
 * Интерфейс обработчика HTTP-ответа (стратегия).
 */
export interface ResponseHandler {
  /** Проверяет, может ли обработчик обработать данный ответ и эндпоинт */
  canHandle(endpoint: EndpointConfig, response: HttpResponse): boolean;
  /** Обрабатывает ответ и возвращает унифицированный ProcessedResponse */
  handle(
    response: HttpResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    options: HandlerOptions
  ): Promise<ProcessedResponse>;
}

/**
 * Фабрика, выбирающая подходящий обработчик ответа.
 */
export class ResponseHandlerFactory {
  private handlers: ResponseHandler[] = [];

  constructor() {
    // Порядок важен: сначала SSE, потом JSON как fallback
    this.handlers.push(new SseHandler(), new JsonHandler());
  }

  /**
   * Зарегистрировать дополнительный обработчик (будет проверен первым).
   */
  register(handler: ResponseHandler): void {
    this.handlers.unshift(handler);
  }

  /**
   * Получить подходящий обработчик для данного ответа и конфигурации.
   */
  get(endpoint: EndpointConfig, response: HttpResponse): ResponseHandler {
    return this.handlers.find((h) => h.canHandle(endpoint, response)) ?? new JsonHandler();
  }
}
