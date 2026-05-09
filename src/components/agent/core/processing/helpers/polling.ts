import { PollingConfig } from 'types';
import { POLLING_DEFAULTS } from '../../../shared/constants';

/**
 * Конфигурация поллинга с заполненными значениями по умолчанию.
 */
const DEFAULT_POLLING_CONFIG: Required<PollingConfig> = {
  enabled: false,
  intervalMs: POLLING_DEFAULTS.intervalMs,
  maxAttempts: POLLING_DEFAULTS.maxAttempts,
  statusField: POLLING_DEFAULTS.statusField,
  successValue: POLLING_DEFAULTS.successValue,
  resultField: POLLING_DEFAULTS.resultField,
  retryStatusCodes: [],
};

/**
 * Выполняет поллинг (периодические запросы) до получения успешного статуса.
 * @param endpoint - конфигурация эндпоинта с polling
 * @param url - URL для повторных запросов
 * @param headers - заголовки
 * @param body - тело запроса
 * @param initialData - данные первого ответа
 * @param onTrace - колбэк трассировки
 * @param signal - сигнал для отмены (AbortController.signal)
 * @returns итоговые данные (возможно, извлечённые через resultField) или исходные
 */
export const handlePolling = async (
  endpoint: { polling?: PollingConfig; method: string },
  url: string,
  headers: HeadersInit,
  body?: string,
  initialData?: any,
  onTrace?: (step: any) => void,
  signal?: AbortSignal
): Promise<any> => {
  // Проверка: если сигнал уже отменён до начала поллинга
  if (signal?.aborted) {
    throw new DOMException('Polling aborted', 'AbortError');
  }

  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;
  if (!polling?.enabled) {
    return initialData;
  }

  let data = initialData;
  let attempts = 1;
  const retryCodes = new Set(polling.retryStatusCodes ?? []);

  const makeRequest = async () => {
    const res = await fetch(url, { method: endpoint.method, headers, body, signal });
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.responseBody = await res.text();
      throw err;
    }
    return res.json();
  };

  while (attempts < polling.maxAttempts) {
    // Проверка отмены в начале каждой итерации
    if (signal?.aborted) {
      throw new DOMException('Polling aborted', 'AbortError');
    }

    if (data[polling.statusField] === polling.successValue) {
      break;
    }

    // Задержка с учётом возможности отмены
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, polling.intervalMs);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Polling aborted', 'AbortError'));
          },
          { once: true }
        );
      }
    });

    try {
      data = await makeRequest();
      if (onTrace) {
        onTrace({
          type: 'polling',
          timestamp: Date.now(),
          pollingAttempt: attempts + 1,
          responseBody: data,
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (retryCodes.has(err.status)) {
        if (onTrace) {
          onTrace({
            type: 'polling',
            timestamp: Date.now(),
            pollingAttempt: attempts + 1,
            error: { status: err.status, message: err.message },
          });
        }
        attempts++;
        continue;
      }
      throw err;
    }
    attempts++;
  }

  if (data[polling.statusField] !== polling.successValue) {
    throw new Error(`Polling timeout after ${polling.maxAttempts} attempts`);
  }

  if (endpoint.polling?.resultField && data[endpoint.polling.resultField] !== undefined) {
    return data[endpoint.polling.resultField];
  }
  return data;
};
