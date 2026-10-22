import { SSEParser, NdjsonParser } from './parsers';
import { EventBus } from 'components/agent/core/eventBus';
import {
  createInitialStreamState,
  processStreamChunk,
  finalizeStream,
  appendTextDelta,
} from './processor';
import { HttpResponse, EndpointConfig, TraceStep, SendResult } from 'types';
import { dotGet } from 'components/agent/utils/utils';
import { matchCustomEventHandler } from './customEvents';

/**
 * AG-UI: события TEXT_MESSAGE_START / TEXT_MESSAGE_END не содержат текста,
 * но задают границы сообщений. Возвращает messageId, если событие — START.
 */
function getTextMessageStartId(event: any): string | undefined {
  if (event && typeof event === 'object' && event.type === 'TEXT_MESSAGE_START') {
    return typeof event.messageId === 'string' ? event.messageId : '';
  }
  return undefined;
}

/** Извлекает дельту текста из события по настройкам извлечения. */
function extractTextDelta(parsedEvent: any, cfg: { textPath?: string; textEventType?: string; textDeltaField?: string }): unknown {
  let textDelta: unknown = null;
  if (cfg.textEventType) {
    if (parsedEvent.type === cfg.textEventType) {
      if (cfg.textDeltaField) {
        textDelta = parsedEvent[cfg.textDeltaField];
      } else if (cfg.textPath) {
        textDelta = dotGet(parsedEvent, cfg.textPath);
      }
    }
  } else if (cfg.textPath) {
    textDelta = dotGet(parsedEvent, cfg.textPath);
  }
  return textDelta;
}

function isStreamingEnabled(
  streaming: EndpointConfig['streaming']
): streaming is Extract<NonNullable<EndpointConfig['streaming']>, { enabled: true }> {
  return streaming !== null && typeof streaming === 'object' && streaming.enabled === true;
}

export async function handleStreamingResponse(
  op: EndpointConfig,
  response: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<SendResult> {
  const streaming = op.streaming;
  if (!isStreamingEnabled(streaming)) {
    return { ok: false, error: 'streaming not enabled' };
  }

  if (streaming.parseStrategy === 'sse') {
    const result = await handleSSEStream(op, response, context, eventBus, onTrace);
    return {
      ok: true,
      data: result.reply,
      context: result.context,
      reasoningText: result.reasoningText,
      isStreaming: true,
      lastEvent: result.lastEvent,
      charts: result.charts.length ? result.charts : undefined,
      error: result.streamError,
    };
  }

  if (streaming.parseStrategy === 'jsonl') {
    const result = await handleNdjsonStream(op, response, context, eventBus, onTrace);
    return {
      ok: true,
      data: result.reply,
      context: result.context,
      reasoningText: result.reasoningText,
      isStreaming: true,
      lastEvent: result.lastEvent,
      charts: result.charts.length ? result.charts : undefined,
      error: result.streamError,
    };
  }

  return { ok: false, error: `Unsupported parse strategy: ${streaming.parseStrategy}` };
}

/**
 * Обработка SSE с возможностью фильтрации событий по типу
 */
async function handleSSEStream(
  op: EndpointConfig,
  res: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<{
  reply: string;
  reasoningText: string | undefined;
  context: Record<string, any>;
  lastEvent: any;
  charts: any[];
  streamError?: string;
}> {
  if (!res.body) {
    throw new Error('SSE response has no body');
  }

  let lastEvent: any;
  let state = createInitialStreamState();

  const streaming = op.streaming;
  const parser = new SSEParser();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

  if (!isStreamingEnabled(streaming)) {
    throw new Error('Streaming config missing');
  }

  const paragraphBetweenMessages = streaming.paragraphBetweenMessages !== false;
  const customRules = streaming.customEvents;

  let rawMessages: string[] | undefined = onTrace ? [] : undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const messages = parser.feed(chunk);
      for (const msg of messages) {
        if (rawMessages) {
          rawMessages.push(msg.data);
        }
        if (msg.data === '[DONE]') {
          continue;
        }

        let parsedEvent: any;
        try {
          parsedEvent = JSON.parse(msg.data);
          lastEvent = parsedEvent;
        } catch {
          onTrace?.({ type: 'sse_parse_error', timestamp: Date.now(), rawLine: msg.data });
          continue;
        }

        // AG-UI: границы текстовых сообщений (TEXT_MESSAGE_START с новым messageId)
        const startId = getTextMessageStartId(parsedEvent);
        let boundaryId: string | undefined;
        if (startId !== undefined && startId !== state.currentMessageId) {
          state.currentMessageId = startId;
          boundaryId = startId;
        }

        // События CUSTOM матчатся только правилами — не пытаемся извлечь из них текст.
        const matchedCustomRule = !!customRules?.length && matchCustomEventHandler(parsedEvent, customRules);
        if (!matchedCustomRule) {
          const textDelta = extractTextDelta(parsedEvent, streaming);
          if (typeof textDelta === 'string') {
            state = appendTextDelta(state, textDelta, eventBus, {
              paragraphBetweenMessages,
              messageId: typeof parsedEvent.messageId === 'string' ? parsedEvent.messageId : state.currentMessageId,
              boundaryMessageId: boundaryId,
            });
          }
        }

        state = processStreamChunk(parsedEvent, op, context, state, eventBus, {
          onTrace,
          eventType: parsedEvent.type,
        });

        if (state.streamError) {
          break;
        }
      }

      if (state.streamError) {
        break;
      }
    }

    if (!state.streamError) {
      const finalMessages = parser.flush();
      for (const msg of finalMessages) {
        if (msg.data === '[DONE]') {
          continue;
        }
        try {
          const parsedEvent = JSON.parse(msg.data);
          state = processStreamChunk(parsedEvent, op, context, state, eventBus, {
            onTrace,
            eventType: parsedEvent.type,
          });
        } catch {}
      }
    }

    state = finalizeStream(state, eventBus);

    if (onTrace && rawMessages) {
      onTrace({
        type: 'fullStream',
        timestamp: Date.now(),
        responseBody: rawMessages.join('\n'),
        isStreaming: true,
      });
    }

    return {
      reply: state.fullReply,
      reasoningText: state.reasoningState.fullText,
      lastEvent,
      context: { ...context, ...state.pendingContext },
      charts: state.charts,
      streamError: state.streamError,
    };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Обработка NDJSON (jsonl)
 */
async function handleNdjsonStream(
  op: EndpointConfig,
  res: HttpResponse,
  context: Record<string, any>,
  eventBus: EventBus,
  onTrace?: (step: TraceStep) => void
): Promise<{
  reply: string;
  reasoningText: string | undefined;
  context: Record<string, any>;
  lastEvent: any;
  charts: any[];
  streamError?: string;
}> {
  if (!res.body) {
    throw new Error('NDJSON response has no body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new NdjsonParser();
  let state = createInitialStreamState();
  let lastEvent: any;
  const streaming = op.streaming;
  if (!isStreamingEnabled(streaming)) {
    throw new Error('Streaming config missing');
  }

  const paragraphBetweenMessages = streaming.paragraphBetweenMessages !== false;
  const customRules = streaming.customEvents;
  let rawMessages: string[] | undefined = onTrace ? [] : undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const objects = parser.feed(chunk);
      for (const obj of objects) {
        if (rawMessages) {
          rawMessages.push(JSON.stringify(obj));
        }
        lastEvent = obj;

        const startId = getTextMessageStartId(obj);
        let boundaryId: string | undefined;
        if (startId !== undefined && startId !== state.currentMessageId) {
          state.currentMessageId = startId;
          boundaryId = startId;
        }

        const matchedCustomRule = !!customRules?.length && matchCustomEventHandler(obj, customRules);
        if (!matchedCustomRule) {
          const textDelta = extractTextDelta(obj, streaming);
          if (typeof textDelta === 'string') {
            state = appendTextDelta(state, textDelta, eventBus, {
              paragraphBetweenMessages,
              messageId: typeof obj.messageId === 'string' ? obj.messageId : state.currentMessageId,
              boundaryMessageId: boundaryId,
            });
          }
        }

        state = processStreamChunk(obj, op, context, state, eventBus, {
          onTrace,
          eventType: obj.type, // может быть undefined, но для jsonl обычно не нужен
        });

        if (state.streamError) {
          break;
        }
      }

      if (state.streamError) {
        break;
      }
    }

    if (!state.streamError) {
      const finalObjects = parser.flush();
      for (const obj of finalObjects) {
        state = processStreamChunk(obj, op, context, state, eventBus, { onTrace, eventType: obj.type });
      }
    }

    state = finalizeStream(state, eventBus);

    if (onTrace && rawMessages) {
      onTrace({
        type: 'fullStream',
        timestamp: Date.now(),
        responseBody: rawMessages.join('\n'),
        isStreaming: true,
      });
    }

    return {
      reply: state.fullReply,
      reasoningText: state.reasoningState.fullText,
      lastEvent,
      context: { ...context, ...state.pendingContext },
      charts: state.charts,
      streamError: state.streamError,
    };
  } finally {
    reader.releaseLock();
  }
}
