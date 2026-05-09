import { TraceStep } from '../shared/types';

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
  private base: string;

  /**
   * @param baseUrl - базовый URL API (например, 'https://api.example.com')
   */
  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, ''); // убираем завершающий слеш
  }

  /** Собирает полный URL из базового и относительного пути */
  private fullUrl(path: string): string {
    return this.base + (path.startsWith('/') ? path : '/' + path);
  }

  /**
   * Выполнить HTTP-запрос.
   * @param request - параметры запроса
   * @param signal - сигнал для отмены (AbortController.signal)
   * @returns унифицированный ответ
   */
  async execute(request: RequestConfig, signal?: AbortSignal): Promise<HttpResponse> {
    const url = this.fullUrl(request.url);

    // Трассировка запроса
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

    // Оборачиваем стандартный Response в наш интерфейс
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
