import { SSEParser, NdjsonParser } from './parsers';
import { EventBus } from 'components/agent/core/eventBus';
import { createInitialStreamState, processStreamChunk, finalizeStream } from './processor';
import { HttpResponse, EndpointConfig, TraceStep, SendResult } from 'types';
import { dotGet } from 'components/agent/utils/utils';
import { finalizeReasoning } from '../reasoning/processor';

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
): Promise<{ reply: string; reasoningText: string | undefined; context: Record<string, any>; lastEvent: any }> {
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

  const textPath = streaming.textPath;
  const textEventType = streaming.textEventType;
  const textDeltaField = streaming.textDeltaField;

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

        let textDelta: string | null = null;
        if (textEventType) {
          if (parsedEvent.type === textEventType) {
            if (textDeltaField) {
              textDelta = parsedEvent[textDeltaField];
            } else if (textPath) {
              textDelta = dotGet(parsedEvent, textPath);
            }
          }
        } else {
          if (textPath) {
            textDelta = dotGet(parsedEvent, textPath);
          }
        }

        if (typeof textDelta === 'string' && textDelta) {
          if (state.reasoningState.active) {
            state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
          }
          state.fullReply += textDelta;
          eventBus.emit('chunk', textDelta);
        }

        state = processStreamChunk(parsedEvent, op, context, state, eventBus, {
          onTrace,
          eventType: parsedEvent.type,
        });
      }
    }

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
      context,
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
): Promise<{ reply: string; reasoningText: string | undefined; context: Record<string, any>; lastEvent: any }> {
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

  const textPath = streaming.textPath;
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

        let textDelta: string | null = null;
        if (textPath) {
          textDelta = dotGet(obj, textPath);
        }

        if (typeof textDelta === 'string' && textDelta) {
          if (state.reasoningState.active) {
            state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
          }
          state.fullReply += textDelta;
          eventBus.emit('chunk', textDelta);
        }

        state = processStreamChunk(obj, op, context, state, eventBus, {
          onTrace,
          eventType: obj.type, // может быть undefined, но для jsonl обычно не нужен
        });
      }
    }

    const finalObjects = parser.flush();
    for (const obj of finalObjects) {
      state = processStreamChunk(obj, op, context, state, eventBus, { onTrace, eventType: obj.type });
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
      context,
    };
  } finally {
    reader.releaseLock();
  }
}
