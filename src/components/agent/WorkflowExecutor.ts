import { EndpointConfig, PollingConfig, TraceStep, StreamingConfig } from '.';
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
    return jsonString;
  }
  if (typeof jsonString === 'string') {
    const trimmed = jsonString.trim();
    if (trimmed === '') {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parsed;
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

const extractValueByPath = (obj: any, path: string): any => {
  if (!path) {
    return obj;
  }
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    if (Array.isArray(acc) && /^\d+$/.test(key)) {
      return acc[parseInt(key, 10)];
    }
    return acc[key];
  }, obj);
};

export const executeEndpoint = async (
  endpoint: EndpointConfig,
  context: WorkflowContext,
  baseUrl: string,
  agentConfig?: string,
  agentHeaders?: string,
  onTrace?: (step: TraceStep) => void,
  onChunk?: (chunk: string) => void
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

  // ----- Conversation history management (before request) -----
  if (endpoint.preserveConversationHistory) {
    if (!context.messages || !Array.isArray(context.messages)) {
      context.messages = [];
    }
    const userMsg = context.user_input;
    if (userMsg && typeof userMsg === 'string') {
      const last = context.messages[context.messages.length - 1];
      if (!last || last.role !== 'user' || last.content !== userMsg) {
        context.messages.push({ role: 'user', content: userMsg });
      }
    }
  }
  // -----------------------------------------------------------

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

  const streaming = endpoint.streaming === true || (endpoint.streaming as StreamingConfig)?.enabled === true;
  let streamConfig: StreamingConfig | null = null;
  if (streaming && typeof endpoint.streaming === 'object') {
    streamConfig = endpoint.streaming as StreamingConfig;
  } else if (streaming) {
    streamConfig = { enabled: true };
  }

  // ---- СТРИМИНГ ----
  if (streaming && streamConfig && onChunk) {
    const response = await fetch(url, { method: endpoint.method, headers, body });
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error body';
      }
      if (onTrace) {
        onTrace({
          type: 'response',
          timestamp: Date.now(),
          responseStatus: response.status,
          responseBody: errorBody,
        });
      }
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    }
    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    const delimiter = streamConfig.delimiter || '\n\n';
    const dataPrefix = streamConfig.dataPrefix || 'data: ';
    const textPath = streamConfig.textPath || 'choices[0].delta.content';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(delimiter);
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed === '' || trimmed === 'data: [DONE]') {
          continue;
        }
        let jsonStr = trimmed;
        if (trimmed.startsWith(dataPrefix)) {
          jsonStr = trimmed.slice(dataPrefix.length);
        }
        try {
          const json = JSON.parse(jsonStr);
          const chunkText = extractValueByPath(json, textPath);
          if (chunkText) {
            onChunk(chunkText);
            fullResponse += chunkText;
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }

    const finalData = {
      reply: fullResponse,
      result: fullResponse,
      choices: [{ message: { content: fullResponse } }],
    };

    // ✅ Исправленная часть: приведение к Record<string, unknown> для безопасного доступа
    const record = finalData as Record<string, unknown>;

    if (endpoint.saveToContext?.length) {
      for (const key of endpoint.saveToContext) {
        const val = record[key];
        if (val !== undefined) {
          context[key] = val;
        }
      }
    } else {
      const exclude = new Set(['reply', 'result', 'status']);
      for (const [key, val] of Object.entries(record)) {
        if (!exclude.has(key)) {
          context[key] = val;
        }
      }
    }

    // Добавляем сообщение ассистента в историю для стриминга
    if (endpoint.preserveConversationHistory && fullResponse) {
      const assistantMsg: any = { role: 'assistant', content: fullResponse };
      if (endpoint.assistantMessageFields?.length) {
        for (const f of endpoint.assistantMessageFields) {
          if (record[f] !== undefined) {
            assistantMsg[f] = record[f];
          }
        }
      }
      context.messages.push(assistantMsg);
    }

    if (onTrace) {
      onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: 200,
        responseBody: finalData,
      });
    }
    return finalData;
  }

  // ---- ОБЫЧНЫЙ ЗАПРОС (не стриминг) ----
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

  // Добавляем ответ ассистента в историю (для обычного запроса)
  if (endpoint.preserveConversationHistory && replyText) {
    const assistantMsg: any = { role: 'assistant', content: replyText };
    if (endpoint.assistantMessageFields?.length) {
      for (const f of endpoint.assistantMessageFields) {
        if (data[f] !== undefined) {
          assistantMsg[f] = data[f];
        }
      }
    }
    context.messages.push(assistantMsg);
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
  onTrace?: (step: TraceStep) => void,
  onChunk?: (chunk: string) => void
): Promise<any> => {
  let lastResponse: any = null;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;
    const chunkCallback = isLast && step.endpoint.streaming ? onChunk : undefined;
    lastResponse = await executeEndpoint(
      step.endpoint,
      context,
      baseUrl,
      agentConfig,
      agentHeaders,
      onTrace,
      chunkCallback
    );
  }
  return lastResponse;
};
