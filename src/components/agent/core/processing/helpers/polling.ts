import { ResolvedPollingConfig } from "../../config/types";

export const handlePolling = async (
  polling: ResolvedPollingConfig,
  method: string,
  url: string,
  headers: HeadersInit,
  body?: string,
  initialData?: any,
  onTrace?: (step: any) => void,
  signal?: AbortSignal
): Promise<any> => {
  if (signal?.aborted) {
    throw new DOMException('Polling aborted', 'AbortError');
  }

  let data = initialData;
  let attempts = 1;
  const retryCodes = new Set(polling.retryStatusCodes);

  const makeRequest = async () => {
    const res = await fetch(url, { method, headers, body, signal });
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.responseBody = await res.text();
      throw err;
    }
    return res.json();
  };

  while (attempts < polling.maxAttempts) {
    if (signal?.aborted) {
      throw new DOMException('Polling aborted', 'AbortError');
    }

    if (data?.[polling.statusField] === polling.successValue) {
      break;
    }

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
      onTrace?.({
        type: 'polling',
        timestamp: Date.now(),
        pollingAttempt: attempts + 1,
        responseBody: data,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (retryCodes.has(err.status)) {
        onTrace?.({
          type: 'polling',
          timestamp: Date.now(),
          pollingAttempt: attempts + 1,
          error: { status: err.status, message: err.message },
        });
        attempts++;
        continue;
      }
      throw err;
    }
    attempts++;
  }

  if (data?.[polling.statusField] !== polling.successValue) {
    throw new Error(`Polling timeout after ${polling.maxAttempts} attempts`);
  }

  if (polling.resultField && data[polling.resultField] !== undefined) {
    return data[polling.resultField];
  }
  return data;
};
