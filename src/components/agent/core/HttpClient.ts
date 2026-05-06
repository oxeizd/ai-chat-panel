import { IHttpClient, RequestConfig, HttpResponse } from '../interfaces/IHttpClient';

/**
 * Реализация HTTP-клиента на основе fetch.
 * Добавляет базовый URL к переданному пути.
 */
export class HttpClient implements IHttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Сборка полного URL из базового и относительного пути */
  private buildFullUrl(path: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const relative = path.startsWith('/') ? path : '/' + path;
    return base + relative;
  }

  /**
   * Выполнение HTTP-запроса.
   * @param request - параметры запроса
   * @param signal - сигнал отмены
   * @returns унифицированный ответ
   */
  async execute(request: RequestConfig, signal?: AbortSignal): Promise<HttpResponse> {
    const fullUrl = this.buildFullUrl(request.url);

    // Трассировка запроса, если передан onTrace
    if (request.onTrace) {
      request.onTrace({
        type: 'request',
        timestamp: Date.now(),
        url: fullUrl,
        method: request.method,
        requestBody: request.body ? JSON.parse(request.body) : undefined,
      });
    }

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });

    // Оборачиваем стандартный Response в наш интерфейс
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      body: response.body,
      clone: () => response.clone(),
      text: () => response.text(),
      json: () => response.json(),
    };
  }
}