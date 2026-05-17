import { TraceStep } from 'types';

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  onTrace?: (step: TraceStep) => void;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  clone(): HttpResponse;
  text(): Promise<string>;
  json(): Promise<any>;
}

export interface HttpExecuteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class HttpClient {
  async execute(request: RequestConfig, signal?: AbortSignal): Promise<HttpResponse> {
    const url = request.url;
    let parsedBody: any = undefined;

    if (request.body) {
      try {
        parsedBody = JSON.parse(request.body);
      } catch {
        parsedBody = request.body;
      }
    }

    request.onTrace?.({
      type: 'request',
      timestamp: Date.now(),
      url,
      method: request.method,
      requestBody: parsedBody,
    });

    const response = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      body: response.body,
      clone: () => response.clone() as unknown as HttpResponse,
      text: () => response.text(),
      json: () => response.json(),
    };
  }
}

/**
 * Выполнить HTTP запрос с поддержкой таймаута и внешнего AbortSignal.
 * При срабатывании таймаута или внешнего сигнала запрос прерывается.
 * Если внешний сигнал уже прерван, выбрасывается ошибка AbortError.
 */
export async function executeHttpRequest(request: RequestConfig, options?: HttpExecuteOptions): Promise<HttpResponse> {
  const http = new HttpClient();

  const { timeoutMs, signal: externalSignal } = options ?? {};

  if (!timeoutMs && !externalSignal) {
    return http.execute(request);
  }

  // Создаём свой AbortController для комбинированного сигнала
  const controller = new AbortController();
  const { signal: innerSignal } = controller;

  // Функция очистки ресурсов
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (abortHandler && externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
      abortHandler = undefined;
    }
  };

  // Обработчик прерывания от внешнего сигнала
  const onExternalAbort = () => {
    cleanup();
    controller.abort();
  };

  // Устанавливаем таймаут
  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      cleanup();
      controller.abort();
    }, timeoutMs);
  }

  // Подписываемся на внешний сигнал
  if (externalSignal) {
    if (externalSignal.aborted) {
      // Если внешний сигнал уже прерван — сразу выбрасываем ошибку
      throw new DOMException('Request aborted by external signal', 'AbortError');
    }
    abortHandler = onExternalAbort;
    externalSignal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    return await http.execute(request, innerSignal);
  } finally {
    cleanup();
  }
}
