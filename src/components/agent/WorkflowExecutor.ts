import { EndpointConfig, PollingConfig, TraceStep, StreamingConfig } from 'types';
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

const mergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => ({
  ...base,
  ...override,
});

const extractValueByPath = (obj: any, path: string): any => {
  if (!path) {
    return obj;
  }
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    if (Array.isArray(acc) && /^\d+$/.test(key)) {
      return acc[parseInt(key, 10)];
    }
    return acc[key];
  }, obj);
};

/**
 * Парсит SSE поток, извлекая текст из событий TEXT_MESSAGE_CONTENT,
 * а также обрабатывает кастомные события синхронизации истории (historySync).
 */
async function parseSSEStream(
  response: Response,
  textPath: string,
  onChunk?: (chunk: string) => void,
  onHistorySync?: (event: any) => void
): Promise<{ fullText: string; finalEvent?: any; rawEvents: any[] }> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';
  let finalEvent: any = undefined;
  const rawEvents: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (trimmed.startsWith(':')) {
        continue;
      }
      if (trimmed === 'data: [DONE]' || trimmed === '[DONE]') {
        return { fullText: fullResponse, finalEvent, rawEvents };
      }

      let jsonStr = trimmed;
      if (trimmed.startsWith('data:')) {
        jsonStr = trimmed.slice(5).trim();
      }

      try {
        const event = JSON.parse(jsonStr);
        rawEvents.push(event);

        if (onHistorySync) {
          onHistorySync(event);
        }

        finalEvent = event;

        let chunkText: string | undefined;
        if (event.choices && Array.isArray(event.choices)) {
          const ch = event.choices[0];
          chunkText = ch?.delta?.content ?? ch?.message?.content ?? undefined;
        }
        if (!chunkText && event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
          chunkText = event.delta;
        }
        if (!chunkText && textPath) {
          const maybe = extractValueByPath(event, textPath);
          if (maybe !== undefined && maybe !== null) {
            chunkText = String(maybe);
          }
        }

        if (chunkText) {
          fullResponse += chunkText;
          if (onChunk) {
            onChunk(chunkText);
          }
        }
      } catch (e) {
        // Невалидный JSON – пропускаем
      }
    }
  }
  return { fullText: fullResponse, finalEvent, rawEvents };
}

export const executeEndpoint = async (
  endpoint: EndpointConfig,
  context: WorkflowContext,
  baseUrl: string,
  agentConfig?: Record<string, any>,
  agentHeaders?: Record<string, string>,
  onTrace?: (step: TraceStep) => void,
  onChunk?: (chunk: string) => void
): Promise<any> => {
  // 1. URL
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

  // 2. Автоматическое добавление сообщения пользователя в историю (если включено)
  if (endpoint.preserveConversationHistory) {
    if (!context.messages || !Array.isArray(context.messages)) {
      context.messages = [];
    }
    const userMsg = context.user_input;
    if (userMsg && typeof userMsg === 'string') {
      const last = context.messages[context.messages.length - 1];
      if (!last || last.role !== 'user' || last.content !== userMsg) {
        const userMessageObj: any = { role: 'user', content: userMsg };
        // Копируем только указанные поля из контекста
        if (endpoint.userMessageFields?.length) {
          for (const field of endpoint.userMessageFields) {
            if (context[field] !== undefined) {
              userMessageObj[field] = context[field];
            }
          }
        }
        context.messages.push(userMessageObj);
      }
    }
  }

  // 3. Подготовка тела запроса (с подстановкой переменных)
  const resolvedAgentConfig = agentConfig ? resolveObject(agentConfig, context) : {};
  const resolvedEndpointBody = endpoint.body ? resolveObject(endpoint.body, context) : {};
  let mergedBody = mergeObjects(resolvedAgentConfig, resolvedEndpointBody);

  // 4. Автоматическая подстановка истории в поле messages (если включена история)
  if (endpoint.preserveConversationHistory && context.messages && Array.isArray(context.messages)) {
    mergedBody.messages = context.messages;
  }

  let body: string | undefined = undefined;
  if (Object.keys(mergedBody).length > 0) {
    body = JSON.stringify(mergedBody);
  }

  // 5. Заголовки
  const mergedHeaders = mergeObjects(agentHeaders || {}, endpoint.headers || {});
  const resolvedHeaders = resolveObject(mergedHeaders, context);
  const headers: HeadersInit = resolvedHeaders as HeadersInit;

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

  // 6. Выполнение запроса
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

  // 7. Определение режима streaming
  const streamingEnabled = endpoint.streaming === true || (endpoint.streaming as StreamingConfig)?.enabled === true;
  const defaultTextPath = 'choices.0.delta.content';
  const streamConfig =
    streamingEnabled && typeof endpoint.streaming === 'object'
      ? (endpoint.streaming as StreamingConfig)
      : streamingEnabled
        ? { enabled: true, textPath: defaultTextPath, delimiter: '\n\n', dataPrefix: 'data:' }
        : null;

  const contentType = response.headers.get('content-type') || '';
  const isSSEByContent = contentType.includes('text/event-stream') || contentType.includes('text/plain');
  let isSSE = streamingEnabled || isSSEByContent;

  let rawText: string | null = null;
  if (!isSSE) {
    try {
      const cloned = response.clone();
      rawText = await cloned.text();
      if (rawText.trim().startsWith('data: ')) {
        isSSE = true;
      }
    } catch {
      rawText = null;
    }
  }

  // 8. Обработка SSE (streaming)
  if (isSSE) {
    const textPath = streamConfig && streamConfig.textPath ? streamConfig.textPath : defaultTextPath;

    let syncedFromSnapshot = false;

    const onHistorySync = (event: any) => {
      if (endpoint.historySync && event.type === endpoint.historySync.eventType) {
        const snapshotMessages = extractValueByPath(event, endpoint.historySync.messagesPath);
        if (Array.isArray(snapshotMessages)) {
          context.messages = snapshotMessages;
          syncedFromSnapshot = true;
          if (onTrace) {
            onTrace({
              type: 'context_update',
              timestamp: Date.now(),
              contextChanges: { messages_snapshot: snapshotMessages },
            });
          }
        }
      }
    };

    const { fullText, finalEvent, rawEvents } = await parseSSEStream(response, textPath, onChunk, onHistorySync);

    const finalData: any = {
      reply: fullText,
      result: fullText,
      finalMetadata: finalEvent,
      rawEvents,
    };

    if (onTrace) {
      onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: response.status,
        responseBody: finalData,
      });
    }

    // Если синхронизация из snapshot не произошла, добавляем сообщение ассистента вручную
    if (endpoint.preserveConversationHistory && fullText && !syncedFromSnapshot) {
      const assistantMsg: any = { role: 'assistant', content: fullText };
      if (endpoint.assistantMessageFields?.length) {
        for (const field of endpoint.assistantMessageFields) {
          if (finalData[field] !== undefined) {
            assistantMsg[field] = finalData[field];
          }
        }
      }
      context.messages.push(assistantMsg);
    }

    // Сохранение в контекст (кроме messages)
    if (endpoint.saveToContext?.length) {
      for (const key of endpoint.saveToContext) {
        if (finalData[key] !== undefined && key !== 'messages') {
          context[key] = finalData[key];
        }
      }
    } else {
      const exclude = new Set(['reply', 'result', 'status', 'messages']);
      for (const [key, val] of Object.entries(finalData)) {
        if (!exclude.has(key)) {
          context[key] = val;
        }
      }
    }

    return finalData;
  }

  // 9. Обычный JSON (не SSE)
  let data: any;
  if (rawText !== null) {
    data = JSON.parse(rawText);
  } else {
    data = await response.json();
  }

  if (onTrace) {
    onTrace({
      type: 'response',
      timestamp: Date.now(),
      responseStatus: response.status,
      responseBody: data,
    });
  }

  // 10. Polling
  const polling = endpoint.polling ? { ...DEFAULT_POLLING_CONFIG, ...endpoint.polling } : null;
  if (polling?.enabled) {
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
  }

  if (endpoint.polling?.resultField && data[endpoint.polling.resultField] !== undefined) {
    data = data[endpoint.polling.resultField];
  }

  // 11. Извлечение reply
  let replyText: string | undefined;
  if (endpoint.replyField) {
    const replyValue = data[endpoint.replyField];
    if (replyValue !== undefined) {
      replyText = String(replyValue);
    }
  } else {
    if (data.choices?.[0]?.message?.content) {
      replyText = data.choices[0].message.content;
    } else if (data.choices?.[0]?.delta?.content) {
      replyText = data.choices[0].delta.content;
    } else if (data.reply !== undefined) {
      replyText = String(data.reply);
    } else if (data.result !== undefined) {
      replyText = String(data.result);
    }
  }
  if (replyText !== undefined) {
    data.reply = replyText;
  }

  // 12. Добавление в историю (для JSON)
  if (endpoint.preserveConversationHistory && replyText) {
    const assistantMsg: any = { role: 'assistant', content: replyText };
    if (endpoint.assistantMessageFields?.length) {
      for (const field of endpoint.assistantMessageFields) {
        if (data[field] !== undefined) {
          assistantMsg[field] = data[field];
        }
      }
    }
    context.messages.push(assistantMsg);
  }

  // 13. Сохранение в контекст (кроме messages)
  if (endpoint.saveToContext?.length) {
    for (const key of endpoint.saveToContext) {
      if (data[key] !== undefined && key !== 'messages') {
        context[key] = data[key];
      }
    }
  } else {
    const exclude = ['reply', 'result', 'status', 'messages'];
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
  baseUrl: string,
  agentConfig?: Record<string, any>,
  agentHeaders?: Record<string, string>,
  onTrace?: (step: TraceStep) => void,
  onChunk?: (chunk: string) => void
): Promise<any> => {
  let lastResponse: any = null;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;
    const chunkCallback =
      isLast && (step.endpoint.streaming === true || (step.endpoint.streaming as StreamingConfig)?.enabled === true)
        ? onChunk
        : undefined;
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
