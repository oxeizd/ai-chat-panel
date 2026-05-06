import { EndpointConfig, TraceStep } from 'types';
import { WorkflowContext } from '../core/ContextManager';
import { HttpResponse } from './IHttpClient';

/**
 * Дополнительные опции для обработчика ответа.
 */
export interface HandlerOptions {
  onChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onTrace?: (step: TraceStep) => void;
  signal?: AbortSignal;
  /** Метаданные запроса (нужны для polling) */
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
  data: any;               // итоговые данные
  replyText?: string;      // извлечённый текст для отображения
  reasoningText?: string;
  rawText?: string;        // полный текст (для SSE)
  rawEvents?: any[];       // все события SSE
}

/**
 * Стратегия обработки HTTP-ответа.
 */
export interface IResponseHandler {
  /** Проверяет, подходит ли обработчик для данного ответа и конфигурации */
  canHandle(endpoint: EndpointConfig, response: HttpResponse): boolean;
  /** Обрабатывает ответ и возвращает унифицированный ProcessedResponse */
  handle(
    response: HttpResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    options?: HandlerOptions
  ): Promise<ProcessedResponse>;
}