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
  // Support 'choices.0.delta.content' and 'choices[0].delta.content'
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
 * Собирает строки SSE и возвращает массив нормализованных data-строк.
 * Поддерживает как "data: {...}", так и сырые JSON-строки.
 * Игнорирует комментарии (строки, начинающиеся с ':').
 */
function extractDataLines(s: string): string[] {
  const lines = s.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    if (t.startsWith(':')) {
      continue;
    } // Игнорируем комментарии SSE
    if (t === 'data: [DONE]' || t === '[DONE]') {
      dataLines.push('[DONE]');
      continue;
    }
    if (t.startsWith('data:')) {
      dataLines.push(t.slice(5).trim());
    } else {
      dataLines.push(t);
    }
  }
  return dataLines;
}

/**
 * Парсит SSE-поток из response.body, собирая многострочные data: блоки,
 * парся их в JSON и извлекая текстовые части по known paths или кастомному textPath.
 * Возвращает полный собранный текст, финальное мета-событие (usage/reasoning) и массив всех сырых событий.
 */
async function parseSSEStream(
  response: Response,
  textPath: string,
  onChunk?: (chunk: string) => void,
  onTraceEvent?: (event: any) => void // опциональный колбэк для логирования каждого события
): Promise<{ fullText: string; finalEvent?: any; rawEvents: any[] }> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  let fullResponse = '';
  let finalEvent: any = undefined;
  const rawEvents: any[] = [];

  let pendingDataBlocks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    acc += decoder.decode(value, { stream: true });

    const parts = acc.split(/\r?\n/);
    acc = parts.pop() || '';

    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (line.startsWith(':')) {
        continue;
      } // Игнорируем комментарии

      if (line === 'data: [DONE]' || line === '[DONE]') {
        // Конец потока
        return { fullText: fullResponse, finalEvent, rawEvents };
      }

      if (line.startsWith('data:')) {
        pendingDataBlocks.push(line.slice(5).trim());
      } else {
        pendingDataBlocks.push(line);
      }

      const combined = pendingDataBlocks.join('');
      try {
        const event = JSON.parse(combined);
        rawEvents.push(event);
        if (onTraceEvent) {
          onTraceEvent(event);
        }

        // Сохранить последнее событие (может содержать usage/reasoning)
        finalEvent = event;

        // Извлекаем текстовый чанк
        let chunkText: string | undefined;

        // OpenAI/OpenRouter style: choices[0].delta.content or choices[0].message.content
        if (event.choices && Array.isArray(event.choices)) {
          const ch = event.choices[0];
          chunkText = ch?.delta?.content ?? ch?.message?.content ?? undefined;
          if (!chunkText && typeof ch?.delta === 'string') {
            chunkText = ch.delta;
          }
        }

        // AG UI style
        if (!chunkText && event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
          chunkText = event.delta;
        }

        // Кастомный textPath
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

        pendingDataBlocks = [];
      } catch (e) {
        // Невалидный JSON — ждём следующих data: частей
      }
    }
  }

  // После конца потока обрабатываем остатки
  const leftover = (pendingDataBlocks.length ? pendingDataBlocks.join('') : '') + acc;
  if (leftover) {
    const lines = extractDataLines(leftover);
    for (const jsonStr of lines) {
      if (jsonStr === '[DONE]') {
        break;
      }
      try {
        const event = JSON.parse(jsonStr);
        rawEvents.push(event);
        if (onTraceEvent) {
          onTraceEvent(event);
        }
        finalEvent = event;
        const chunkText =
          event?.choices?.[0]?.delta?.content ??
          event?.choices?.[0]?.message?.content ??
          (event.type === 'TEXT_MESSAGE_CONTENT' ? event.delta : undefined) ??
          (textPath ? extractValueByPath(event, textPath) : undefined);
        if (chunkText) {
          fullResponse += chunkText;
          if (onChunk) {
            onChunk(chunkText);
          }
        }
      } catch (e) {
        // ignore
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
  // 1. Формирование URL
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

  // 2. Тело запроса
  const resolvedAgentConfig = agentConfig ? resolveObject(agentConfig, context) : {};
  const resolvedEndpointBody = endpoint.body ? resolveObject(endpoint.body, context) : {};
  const mergedBody = mergeObjects(resolvedAgentConfig, resolvedEndpointBody);
  let body: string | undefined = undefined;
  if (Object.keys(mergedBody).length > 0) {
    body = JSON.stringify(mergedBody);
  }

  // 3. История сообщений
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

  // 4. Заголовки
  const mergedHeaders = mergeObjects(agentHeaders || {}, endpoint.headers || {});
  const resolvedHeaders = resolveObject(mergedHeaders, context);
  const headers: HeadersInit = resolvedHeaders as HeadersInit;

  // Трейс запроса
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

  // 5. Выполняем запрос
  const response = await fetch(url, { method: endpoint.method, headers, body });

  // 6. Обработка ошибок HTTP
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

  // 7. Определяем, нужно ли использовать streaming
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

  // 8. Обработка SSE
  if (isSSE) {
    const textPath = streamConfig && streamConfig.textPath ? streamConfig.textPath : defaultTextPath;

    // Вспомогательная функция для отправки событий в trace (каждое сырое событие)
    const traceRawEvent = (event: any) => {
      if (onTrace) {
        onTrace({
          type: 'response', // можно было бы создать отдельный тип 'sse_event', но для простоты используем response
          timestamp: Date.now(),
          responseBody: { sseEvent: event },
        });
      }
    };

    const { fullText, finalEvent, rawEvents } = await parseSSEStream(response, textPath, onChunk, traceRawEvent);

    const finalData: any = {
      reply: fullText,
      result: fullText,
      finalMetadata: finalEvent,
      rawEvents: rawEvents, // сохраняем все сырые события
    };

    if (onTrace) {
      onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: response.status,
        responseBody: finalData, // здесь будет reply, result, rawEvents
      });
    }

    // Сохраняем в контекст
    if (endpoint.saveToContext?.length) {
      for (const key of endpoint.saveToContext) {
        if (finalData[key] !== undefined) {
          context[key] = finalData[key];
        }
      }
    } else {
      const exclude = new Set(['reply', 'result', 'status']);
      for (const [key, val] of Object.entries(finalData)) {
        if (!exclude.has(key)) {
          context[key] = val;
        }
      }
    }

    // Сохраняем историю
    if (endpoint.preserveConversationHistory && fullText) {
      const assistantMsg: any = { role: 'assistant', content: fullText };
      if (endpoint.assistantMessageFields?.length) {
        for (const f of endpoint.assistantMessageFields) {
          if (finalData[f] !== undefined) {
            assistantMsg[f] = finalData[f];
          }
        }
      }
      context.messages.push(assistantMsg);
    }

    return finalData;
  }

  // 9. Обычный JSON (не SSE)
  let data: any;
  if (rawText !== null) {
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      const txt = rawText.trim();
      if (!txt) {
        data = {};
      } else {
        throw e;
      }
    }
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

  // 10. Polling (если настроен)
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

  // 12. Сохранение истории
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

  // 13. Сохранение в контекст
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

  if (onTrace && Object.keys(data).length > 0) {
    onTrace({
      type: 'context_update',
      timestamp: Date.now(),
      contextChanges: data,
    });
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
