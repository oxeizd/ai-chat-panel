import { DEFAULT_POLLING } from 'components/agent/config/defaults';
import { dotGet, parseHttpResponse, applySaveToContext } from '../../utils/utils';
import { HttpResponse, EndpointConfig, SendResult, TraceStep } from 'types';
import { extractReasoningFromFullResponse } from '../reasoning/processor';
import { EventBus } from '../../core/eventBus';

export async function handlePolling(
  op: EndpointConfig,
  doFetchOnce: () => Promise<HttpResponse>,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<SendResult> {
  const polling = op.polling;

  if (!polling?.enabled) {
    return { ok: false, error: 'polling not enabled' };
  }

  const intervalMs = polling.intervalMs ?? DEFAULT_POLLING.intervalMs;
  const maxAttempts = polling.maxAttempts ?? DEFAULT_POLLING.maxAttempts;
  const statusField = polling.statusField ?? DEFAULT_POLLING.statusField;
  const successValue = polling.successValue ?? DEFAULT_POLLING.successValue;
  const resultField = polling.resultField ?? DEFAULT_POLLING.resultField;
  const retryStatusCodes = new Set(polling.retryStatusCodes ?? []);

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    onTrace?.({
      type: 'polling_attempt',
      timestamp: Date.now(),
      attempt: attempts,
      maxAttempts,
      status: 'started',
    });

    try {
      const res = await doFetchOnce();
      const { body, reply } = await parseHttpResponse(res, op.replyField);

      // ✅ Применяем сохранение полей в контекст (было)
      applySaveToContext(context, op.saveToContext, body);
      console.log(body);

      const status = dotGet(body, statusField);

      let finalReply = reply;
      if (op.reasoning?.enabled) {
        const result = extractReasoningFromFullResponse(body, reply, op.reasoning, eventBus, onTrace);
        finalReply = result.cleanedReply;
      }

      if (status === successValue) {
        const result = resultField ? dotGet(body, resultField) : finalReply;

        onTrace?.({
          type: 'polling_attempt',
          timestamp: Date.now(),
          attempt: attempts,
          status: 'success',
          result,
        });

        return {
          ok: true,
          data: result,
          context,
        };
      }

      // Статус не success, но не ошибка – продолжаем опрос
      onTrace?.({
        type: 'polling_attempt',
        timestamp: Date.now(),
        attempt: attempts,
        status: 'not_ready',
        currentStatus: status,
      });
    } catch (err: any) {
      const statusCode = err.status ?? err.statusCode;
      const shouldRetry = retryStatusCodes.has(statusCode) && attempts < maxAttempts;

      onTrace?.({
        type: 'polling_attempt',
        timestamp: Date.now(),
        attempt: attempts,
        status: 'error',
        error: err.message,
        willRetry: shouldRetry,
        statusCode,
      });

      if (shouldRetry) {
        await delay(intervalMs);
        continue;
      }

      return {
        ok: false,
        error: err.message,
      };
    }

    if (attempts < maxAttempts) {
      onTrace?.({
        type: 'polling_delay',
        timestamp: Date.now(),
        attempt: attempts,
        delayMs: intervalMs,
      });
      await delay(intervalMs);
    }
  }

  onTrace?.({
    type: 'polling_timeout',
    timestamp: Date.now(),
    attempts: maxAttempts,
  });

  return {
    ok: false,
    error: `Polling timeout after ${maxAttempts} attempts`,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
