import { TraceStep } from 'types';

/**
 * Конфигурация HTTP-запроса для отправки.
 */
export interface RequestConfig {
  url: string;                     // путь (не полный URL, базовый добавляется клиентом)
  method: string;
  headers: Record<string, string>;
  body?: string;
  onTrace?: (step: TraceStep) => void;
}

/**
 * Унифицированный интерфейс HTTP-ответа.
 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  clone(): HttpResponse;
  text(): Promise<string>;
  json(): Promise<any>;
}

/**
 * Интерфейс HTTP-клиента. Выполняет запрос и возвращает HttpResponse.
 */
export interface IHttpClient {
  execute(request: RequestConfig, signal?: AbortSignal): Promise<HttpResponse>;
}