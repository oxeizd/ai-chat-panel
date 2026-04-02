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

  let body: string | undefined;
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
    const response = await fetch(url, { method: endpoint.method, headers, body });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} on ${endpoint.method} ${url}`);
    }
    return response.json();
  };

  let data = await makeRequest();

  // Polling handling
  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;
  if (polling?.enabled) {
    let attempts = 1;
    while (attempts < polling.maxAttempts) {
      if (data[polling.statusField] === polling.successValue) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, polling.intervalMs));
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

  // --- Extract reply text for the chat ---
  let replyText: string | undefined;

  if (endpoint.replyField) {
    // Use explicitly configured field
    const replyValue = data[endpoint.replyField];
    if (replyValue !== undefined) {
      replyText = String(replyValue);
    }
  } else {
    // Auto-detection: OpenRouter style, then common fields
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

  // Save fields into context
  if (endpoint.saveToContext?.length) {
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
