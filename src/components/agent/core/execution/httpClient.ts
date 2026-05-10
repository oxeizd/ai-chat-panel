import { TraceStep } from "types";

/**
 * Конфигурация одного HTTP-запроса.
 */
export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  onTrace?: (step: TraceStep) => void;
}

/**
 * Унифицированный HTTP-ответ (обёртка над стандартным Response).
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
 * HTTP-клиент на основе fetch.
 * Добавляет базовый URL ко всем запросам и опционально трассирует их.
 */
export class HttpClient {
  async execute(request: RequestConfig, signal?: AbortSignal): Promise<HttpResponse> {
    const url = request.url;

    request.onTrace?.({
      type: 'request',
      timestamp: Date.now(),
      url,
      method: request.method,
      requestBody: request.body ? JSON.parse(request.body) : undefined,
    });

    const res = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });

    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      body: res.body,
      clone: () => res.clone(),
      text: () => res.text(),
      json: () => res.json(),
    };
  }
}
