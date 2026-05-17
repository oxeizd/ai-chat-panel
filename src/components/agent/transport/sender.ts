import { EventBus } from '../core/eventBus';
import { executeHttpRequest } from '../http/httpClient';
import { handlePolling } from './polling/executor';
import { handleStreamingResponse } from './streaming/executor';
import { DEFAULT_CHAT_REPLY_FIELD, DEFAULT_RETRY, DEFAULT_TIMEOUT } from '../config/defaults';
import { extractReasoningFromFullResponse } from './reasoning/processor';
import { applySaveToContext, dotGet, parseHttpResponse } from '../utils/utils';
import { AgentConfig, EndpointConfig, SendResult, TraceStep } from '../config/types';
import { saveAssistantMessage } from '../core/historyManager';
import { buildRequestConfig } from './requestBuilder';

export async function sendOperation(
  agent: AgentConfig,
  operation: string,
  context: Record<string, any>,
  eventBus: EventBus,
  opts?: { timeoutMs?: number; retries?: number; onTrace?: (step: TraceStep) => void; signal?: AbortSignal }
): Promise<SendResult> {
  const op = agent.endpoints.find((e) => e.operation === operation);

  if (!op) {
    return {
      ok: false,
      error: `operation not found: ${operation}`,
    };
  }

  const signal = opts?.signal;
  const onTrace = opts?.onTrace;
  const retries = opts?.retries ?? DEFAULT_RETRY;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT;

  const isPolling = op.polling?.enabled;
  const isStreaming = op.streaming?.enabled;
  const isLocalHistory = op.historyConfig?.enabled && op.historyConfig.mode === 'local';

  const req = () => buildRequestConfig(op, context, onTrace);
  const doFetch = async () => executeHttpRequest(req(), { timeoutMs, signal });

  if (isPolling) {
    const pollingResult = await handlePolling(op, doFetch, context, eventBus, onTrace);

    if (pollingResult.ok && isLocalHistory) {
      await processApiResponse(op, null, pollingResult.data, context, eventBus, { onTrace });
    }

    return pollingResult;
  }

  if (isStreaming) {
    const res = await doFetch();

    if (!res.ok) {
      const errorText = await res.text();

      return {
        ok: false,
        error: `HTTP ${res.status}: ${errorText}`,
      };
    }

    if (!res.body) {
      const { body, reply } = await parseHttpResponse(res, op.replyField || DEFAULT_CHAT_REPLY_FIELD.streaming);
      const { finalReply } = await processApiResponse(op, body, reply, context, eventBus, { onTrace });

      return {
        ok: true,
        data: finalReply,
        context,
      };
    }

    const streamResult = await handleStreamingResponse(op, res, context, eventBus, onTrace);

    if (streamResult.ok) {
      const { finalReply, fileAttachment } = await processApiResponse(op, null, streamResult.data, context, eventBus, {
        lastEvent: streamResult.lastEvent,
        isStreaming: streamResult.isStreaming,
        streamingReasoningText: streamResult.reasoningText,
        onTrace,
      });

      return {
        ok: true,
        data: finalReply,
        context,
        isStreaming: true,
        fileAttachment,
      };
    }
    return streamResult;
  }

  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await executeHttpRequest(req(), { signal: signal });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const { body, reply } = await parseHttpResponse(res, op.replyField || DEFAULT_CHAT_REPLY_FIELD.json);

      onTrace?.({
        type: 'response',
        timestamp: Date.now(),
        responseBody: body,
      });

      const { finalReply, fileAttachment } = await processApiResponse(op, body, reply, context, eventBus, { onTrace });

      return {
        ok: true,
        data: finalReply,
        context,
        fileAttachment,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  return {
    ok: false,
    error: lastError?.message || 'Request failed',
  };
}

async function processApiResponse(
  op: EndpointConfig,
  parsedBody: any | null,
  rawReply: any,
  context: Record<string, any>,
  eventBus: EventBus,
  options?: {
    isStreaming?: boolean;
    lastEvent?: any;
    streamingReasoningText?: string;
    onTrace?: (step: TraceStep) => void;
  }
): Promise<{ finalReply: any; reasoningText?: string; fileAttachment?: any; context: Record<string, any> }> {
  applySaveToContext(context, op.saveToContext, parsedBody);

  let finalReply = rawReply;
  let reasoningText = options?.streamingReasoningText;

  if (!options?.isStreaming && op.reasoning?.enabled && !reasoningText) {
    const result = extractReasoningFromFullResponse(parsedBody, rawReply, op.reasoning, eventBus, options?.onTrace);

    finalReply = result.cleanedReply;

    if (result.extracted && op.reasoning.type === 'embedded' && op.reasoning.mode === 'api_field') {
      reasoningText = dotGet(parsedBody, op.reasoning.apiField);
    }
  }

  let rawBody = parsedBody;

  if (options?.isStreaming) {
    rawBody = options?.lastEvent;
  }

  let fileAttachment: any = undefined;
  if (op.fileField && rawBody) {
    const rawFile = dotGet(rawBody, op.fileField);

    if (rawFile) {
      if (typeof rawFile === 'string') {
        fileAttachment = { filename: 'download', data: rawFile, isUrl: rawFile.startsWith('http') };
      } else if (typeof rawFile === 'object') {
        fileAttachment = {
          filename: rawFile.filename || 'download',
          data: rawFile.data || rawFile,
          mimeType: rawFile.mimeType,
          isUrl: rawFile.isUrl || false,
        };
      }
    }
  }

  if (op.historyConfig?.enabled && op.historyConfig.mode === 'local') {
    saveAssistantMessage(context, rawBody, finalReply, reasoningText, op, options?.isStreaming, options?.onTrace);
  }

  return { finalReply, reasoningText, fileAttachment, context };
}
