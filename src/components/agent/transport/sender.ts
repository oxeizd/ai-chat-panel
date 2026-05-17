import { EventBus } from '../core/eventBus';
import { executeHttpRequest } from '../http/httpClient';
import { handlePolling } from './polling/executor';
import { handleStreamingResponse } from './streaming/executor';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT } from '../config/defaults';
import { extractReasoningFromFullResponse } from './reasoning/processor';
import { applySaveToContext, dotGet, parseHttpResponse } from '../utils/utils';
import { AgentConfig, EndpointConfig, SendResult, TraceStep } from '../config/types';
import { recordChatHistory } from '../core/historyManager';
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
      const { body, reply } = await parseHttpResponse(res, op.replyField);
      const { finalReply } = await processApiResponse(op, body, reply, context, eventBus, { onTrace });

      return {
        ok: true,
        data: finalReply,
        context,
      };
    }

    const streamResult = await handleStreamingResponse(op, res, context, eventBus, onTrace);

    if (streamResult.ok) {
      const { finalReply } = await processApiResponse(op, null, streamResult.data, context, eventBus, {
        streamingReasoningText: streamResult.reasoningText,
        onTrace,
      });

      return {
        ok: true,
        data: finalReply,
        context,
        isStreaming: true,
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

      const { body, reply } = await parseHttpResponse(res, op.replyField);
      const { finalReply } = await processApiResponse(op, body, reply, context, eventBus, { onTrace });

      return {
        ok: true,
        data: finalReply,
        context,
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
    streamingReasoningText?: string;
    onTrace?: (step: TraceStep) => void;
  }
): Promise<{ finalReply: any; reasoningText?: string; context: Record<string, any> }> {
  applySaveToContext(context, op.saveToContext, parsedBody);

  let finalReply = rawReply;
  let reasoningText = options?.streamingReasoningText;

  if (op.reasoning?.enabled && !reasoningText) {
    const result = extractReasoningFromFullResponse(
      parsedBody, 
      rawReply, 
      op.reasoning,
      eventBus, 
      options?.onTrace
    );

    finalReply = result.cleanedReply;

    if (result.extracted && op.reasoning.type === 'embedded' && op.reasoning.mode === 'api_field') {
      reasoningText = dotGet(parsedBody, op.reasoning.apiField);
    }
  }

  if (op.historyConfig?.enabled && op.historyConfig.mode === 'local') {
    recordChatHistory(context, op, finalReply, reasoningText, options?.onTrace);
  }

  console.log(reasoningText)
  return { finalReply, reasoningText, context };
}
