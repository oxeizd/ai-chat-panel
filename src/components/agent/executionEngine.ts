import { EndpointConfig, StreamingConfig, TraceStep } from 'types';
import { handlePolling } from './utils/polling';
import { resolveObject } from './utils/variableResolver';
import { extractValueByPath, mergeObjects } from './utils/objectHelpers';
import { buildUrl, buildRequestBody, extractReply, saveToContext } from './utils/httpHelpers';
import { addAssistantMessageToHistory, addUserMessageToHistory } from './utils/historyManager';
import { isStreamingEnabled, getStreamConfig, detectSSEByContent, parseSSEStream } from './utils/streaming';

export interface WorkflowContext extends Record<string, any> {
  messages?: any[];
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
  const url = buildUrl(endpoint, context, baseUrl);

  // 2. Тело запроса
  let { mergedBody, bodyString } = buildRequestBody(endpoint, context, agentConfig);

  // 3. История (сохраняем user message в контекст)
  addUserMessageToHistory(endpoint, context, mergedBody);
  if (endpoint.preserveConversationHistory) {
    mergedBody.messages = context.messages;
    if (Object.keys(mergedBody).length > 0) {
      bodyString = JSON.stringify(mergedBody);
    }
  }

  // 4. Заголовки
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

  // 5. Выполнение запроса
  const response = await fetch(url, { method: endpoint.method, headers, body: bodyString });
  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = 'Unable to read error body';
    }
    if (onTrace) {
      onTrace({ type: 'response', timestamp: Date.now(), responseStatus: response.status, responseBody: errorBody });
    }
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
  }

  // 6. Определение streaming
  const streamingEnabled = isStreamingEnabled(endpoint);
  const streamConfig = getStreamConfig(endpoint);
  let isSSE = streamingEnabled || detectSSEByContent(response);

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

  // 7. Обработка SSE
  if (isSSE) {
    const textPath = streamConfig?.textPath ?? 'choices.0.delta.content';
    const dataPrefix = streamConfig?.dataPrefix ?? 'data:';

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

    const { fullText, finalEvent, rawEvents } = await parseSSEStream(
      response,
      textPath,
      dataPrefix,
      onChunk,
      onHistorySync
    );
    const finalData: any = { reply: fullText, result: fullText, finalMetadata: finalEvent, rawEvents };

    if (onTrace) {
      onTrace({ type: 'response', timestamp: Date.now(), responseStatus: response.status, responseBody: finalData });
    }

    // Добавление ассистента в историю (если не было синхронизации)
    if (endpoint.preserveConversationHistory && fullText && !syncedFromSnapshot) {
      addAssistantMessageToHistory(endpoint, context, finalEvent || { reply: fullText }, fullText, syncedFromSnapshot);
    }

    saveToContext(endpoint, context, finalData, ['reply', 'result', 'status']);
    return finalData;
  }

  // 8. Обычный JSON
  let data: any = rawText ? JSON.parse(rawText) : await response.json();

  if (data && data.error) {
    const err: any = new Error(data.error.message || 'API error');
    err.status = data.error.code || data.error.status || 500;
    err.responseBody = JSON.stringify(data.error);
    throw err;
  }

  if (onTrace) {
    onTrace({ type: 'response', timestamp: Date.now(), responseStatus: response.status, responseBody: data });
  }

  // 9. Polling
  data = await handlePolling(endpoint, url, headers, bodyString, data, onTrace);

  // 10. Извлечение reply
  const { replyText, dataWithReply } = extractReply(data, endpoint.replyField);
  data = dataWithReply;

  // 11. Добавление ассистента в историю
  addAssistantMessageToHistory(endpoint, context, data, replyText);

  // 12. Сохранение в контекст
  saveToContext(endpoint, context, data, ['reply', 'result', 'status']);

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
