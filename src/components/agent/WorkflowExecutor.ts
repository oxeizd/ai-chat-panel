import { EndpointConfig, PollingConfig } from 'types';
import { VariableContext, resolveString, resolveObject } from './VariableResolver';

export interface WorkflowContext extends VariableContext {
  thread_id?: string;
  run_id?: string;
  user_input?: string;
  [key: string]: any;
}

const DEFAULT_POLLING_CONFIG: Required<PollingConfig> = {
  enabled: false,
  intervalMs: 1000,
  maxAttempts: 10,
  statusField: 'status',
  successValue: 'completed',
  resultField: 'result',
};

export const executeEndpoint = async (
  endpoint: EndpointConfig,
  context: WorkflowContext,
  baseUrl: string
): Promise<any> => {
  const path = resolveString(endpoint.path, context);
  const url = `${baseUrl}${path}`;

  let body: any = undefined;
  if (endpoint.body) {
    try {
      const parsedBody = JSON.parse(endpoint.body);
      const resolvedBody = resolveObject(parsedBody, context);
      body = JSON.stringify(resolvedBody);
    } catch (e) {
      console.warn('Invalid JSON in endpoint body, ignoring', e);
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(endpoint.headers || {}),
  };

  const makeRequest = async (): Promise<any> => {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} on ${endpoint.method} ${url}`);
    }
    return response.json();
  };

  let data = await makeRequest();

  // Обработка polling
  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;
  if (polling?.enabled) {
    let attempts = 1;
    while (attempts < polling.maxAttempts) {
      const status = data[polling.statusField];
      if (status === polling.successValue) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, polling.intervalMs));
      data = await makeRequest();
      attempts++;
    }
    if (attempts === polling.maxAttempts && data[polling.statusField] !== polling.successValue) {
      throw new Error(`Polling timeout after ${polling.maxAttempts} attempts`);
    }
    if (polling.resultField && data[polling.resultField] !== undefined) {
      data = data[polling.resultField];
    }
  }

  // Автоматическое извлечение текста из ответов OpenRouter и подобных структур
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    data.reply = data.choices[0].message.content;
  }

  // Сохраняем поля в контекст
  if (endpoint.saveToContext && endpoint.saveToContext.length) {
    for (const key of endpoint.saveToContext) {
      if (data[key] !== undefined) {
        context[key] = data[key];
      }
    }
  } else {
    const exclude = ['reply', 'result', 'status'];
    for (const [key, value] of Object.entries(data)) {
      if (!exclude.includes(key)) {
        context[key] = value;
      }
    }
  }

  return data;
};

export const executeWorkflow = async (
  steps: Array<{ endpoint: EndpointConfig }>,
  context: WorkflowContext,
  baseUrl: string
): Promise<any> => {
  let lastResponse: any = null;
  for (const step of steps) {
    lastResponse = await executeEndpoint(step.endpoint, context, baseUrl);
  }
  return lastResponse;
};
