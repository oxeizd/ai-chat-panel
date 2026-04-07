import { EndpointConfig, PollingConfig, TraceStep } from 'types';
import { VariableContext, resolveString, resolveObject } from './VariableResolver';

export interface WorkflowContext extends VariableContext {
  [key: string]: any;
}

const DEFAULT_POLLING_CONFIG: Required<PollingConfig> = {
  enabled: false,
  intervalMs: 1000,
  maxAttempts: 10,
  statusField: 'status',
  successValue: 'completed',
  resultField: 'result',
  retryStatusCodes: [],
};

const parseJson = (jsonString?: any): any => {
  if (typeof jsonString === 'object' && jsonString !== null) {
    return jsonString; // уже объект или массив
  }
  if (typeof jsonString === 'string') {
    const trimmed = jsonString.trim();
    if (trimmed === '') {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parsed; // может быть массивом, числом и т.д.
    } catch {
      return {};
    }
  }
  return {};
};

const mergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => ({
  ...base,
  ...override,
});

export const executeEndpoint = async (
  endpoint: EndpointConfig,
  context: WorkflowContext,
  baseUrl: string,
  agentConfig?: string,
  agentHeaders?: string,
  onTrace?: (step: TraceStep) => void
): Promise<any> => {
  let resolvedBaseUrl = baseUrl;

  if (!resolvedBaseUrl) {
    resolvedBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (resolvedBaseUrl.startsWith('/')) {
    resolvedBaseUrl = (typeof window !== 'undefined' ? window.location.origin : '') + resolvedBaseUrl;
  }

  const path = resolveString(endpoint.path, context);

  const combine = (base: string, relative: string) => {
    if (!relative) {
      return base;
    }
    const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
    const relativeClean = relative.startsWith('/') ? relative : '/' + relative;
    return baseClean + relativeClean;
  };

  const url = combine(resolvedBaseUrl, path);

  const endpointBodyObj = endpoint.body ? parseJson(endpoint.body) : {};
  const agentConfigObj = agentConfig ? parseJson(agentConfig) : {};

  const resolvedAgentConfig = resolveObject(agentConfigObj, context);
  const resolvedEndpointBody = resolveObject(endpointBodyObj, context);

  const mergedBody = mergeObjects(resolvedAgentConfig, resolvedEndpointBody);
  let body: string | undefined;
  if (Object.keys(mergedBody).length > 0) {
    body = JSON.stringify(mergedBody);
  }

  const endpointHeadersObj = endpoint.headers ? parseJson(endpoint.headers) : {};
  const agentHeadersObj = agentHeaders ? parseJson(agentHeaders) : {};
  const mergedHeaders = mergeObjects(agentHeadersObj, endpointHeadersObj);
  const headers: HeadersInit = mergedHeaders as HeadersInit;

  if (onTrace) {
    onTrace({
      type: 'request',
      timestamp: Date.now(),
      endpoint,
      url,
      method: endpoint.method,
      requestBody: mergedBody,
    });
  }

  const makeRequest = async (): Promise<any> => {
    const response = await fetch(url, { method: endpoint.method, headers, body });
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Unable to read error body';
      }
      const error: any = new Error(`HTTP ${response.status} on ${endpoint.method} ${url}`);
      error.status = response.status;
      error.responseBody = errorBody;
      throw error;
    }
    return response.json();
  };

  let data = await makeRequest();

  if (onTrace) {
    onTrace({
      type: 'response',
      timestamp: Date.now(),
      responseStatus: 200,
      responseBody: data,
    });
  }

  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;

  if (polling?.enabled) {
    let attempts = 1;
    const retryCodes = new Set(polling.retryStatusCodes ?? []);

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
  }

  if (endpoint.polling?.resultField && data[endpoint.polling.resultField] !== undefined) {
    data = data[endpoint.polling.resultField];
  }

  // Извлечение reply
  let replyText: string | undefined;
  if (endpoint.replyField) {
    const replyValue = data[endpoint.replyField];
    if (replyValue !== undefined) {
      replyText = String(replyValue);
    }
  } else {
    if (data.choices?.[0]?.message?.content) {
      replyText = data.choices[0].message.content;
    } else if (data.reply !== undefined) {
      replyText = String(data.reply);
    } else if (data.result !== undefined) {
      replyText = String(data.result);
    }
  }
  if (replyText !== undefined) {
    data.reply = replyText;
  }

  const contextChanges: Record<string, any> = {};
  if (endpoint.saveToContext?.length) {
    for (const key of endpoint.saveToContext) {
      if (data[key] !== undefined) {
        contextChanges[key] = data[key];
        context[key] = data[key];
      }
    }
  } else {
    const exclude = ['reply', 'result', 'status'];
    for (const [key, value] of Object.entries(data)) {
      if (!exclude.includes(key)) {
        contextChanges[key] = value;
        context[key] = value;
      }
    }
  }

  if (onTrace && Object.keys(contextChanges).length > 0) {
    onTrace({
      type: 'context_update',
      timestamp: Date.now(),
      contextChanges,
    });
  }

  return data;
};

export const executeWorkflow = async (
  steps: Array<{ endpoint: EndpointConfig }>,
  context: WorkflowContext,
  baseUrl: string,
  agentConfig?: string,
  agentHeaders?: string,
  onTrace?: (step: TraceStep) => void
): Promise<any> => {
  let lastResponse: any = null;
  for (const step of steps) {
    lastResponse = await executeEndpoint(step.endpoint, context, baseUrl, agentConfig, agentHeaders, onTrace);
  }
  return lastResponse;
};
