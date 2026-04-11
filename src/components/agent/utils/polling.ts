import { PollingConfig } from 'types';

export const DEFAULT_POLLING_CONFIG: Required<PollingConfig> = {
  enabled: false,
  intervalMs: 1000,
  maxAttempts: 10,
  statusField: 'status',
  successValue: 'completed',
  resultField: 'result',
  retryStatusCodes: [],
};

export const handlePolling = async (
  endpoint: { polling?: PollingConfig; method: string },
  url: string,
  headers: HeadersInit,
  body?: string,
  initialData?: any,
  onTrace?: (step: any) => void
): Promise<any> => {
  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;
  if (!polling?.enabled) {
    return initialData;
  }

  let data = initialData;
  let attempts = 1;
  const retryCodes = new Set(polling.retryStatusCodes ?? []);
  const makeRequest = async () => {
    const res = await fetch(url, { method: endpoint.method, headers, body });
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.responseBody = await res.text();
      throw err;
    }
    return res.json();
  };

  while (attempts < polling.maxAttempts) {
    if (data[polling.statusField] === polling.successValue) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, polling.intervalMs));
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
