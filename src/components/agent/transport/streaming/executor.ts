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

  // jsonl и langgraph обрабатываются через NDJSON парсер
  if (streaming.parseStrategy === 'jsonl' || streaming.parseStrategy === 'langgraph') {
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

// Обработка SSE (без изменений)
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

  let rawMessages: string[] | undefined;
  if (onTrace) {
    rawMessages = [];
  }

  let lastEvent: any;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();
  let state = createInitialStreamState();

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
        let event: any;
        try {
          event = JSON.parse(msg.data);
          lastEvent = event;
        } catch {
          onTrace?.({ type: 'sse_parse_error', timestamp: Date.now(), rawLine: msg.data });
          continue;
        }
        state = processStreamChunk(event, op, context, state, eventBus, {
          onTrace,
          eventType: msg.event,
        });
      }
    }
    const finalMessages = parser.flush();

    for (const msg of finalMessages) {
      if (msg.data === '[DONE]') {
        continue;
      }
      try {
        const event = JSON.parse(msg.data);
        state = processStreamChunk(event, op, context, state, eventBus, {
          onTrace,
          eventType: msg.event,
        });
      } catch {}
    }

    state = finalizeStream(state, eventBus);

    if (onTrace && rawMessages) {
      onTrace?.({
        type: 'response',
        timestamp: Date.now(),
        responseBody: rawMessages.join('\n'),
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

// Единый обработчик NDJSON (jsonl и langgraph)
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

  let rawMessages: string[] | undefined;
  if (onTrace) {
    rawMessages = [];
  }

  let textEventType: string | undefined;
  let textDeltaField: string | undefined;
  let textPath = streaming.textPath;

  if (streaming.parseStrategy === 'langgraph') {
    textEventType = streaming.textEventType ?? 'TEXT_MESSAGE_CONTENT';
    textDeltaField = streaming.textDeltaField ?? 'delta';
  } else if (streaming.parseStrategy === 'jsonl') {
    textEventType = streaming.textEventType;
    textDeltaField = streaming.textDeltaField;
  }

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

        // Извлечение текста в приоритетном порядке:
        // 1) Если задан eventType и тип объекта совпадает + есть deltaField
        // 2) Если нет eventType, но есть textPath
        if (textEventType && obj.type === textEventType) {
          if (textDeltaField) {
            textDelta = obj[textDeltaField];
          } else if (textPath) {
            textDelta = dotGet(obj, textPath);
          }
        } else if (!textEventType && textPath) {
          textDelta = dotGet(obj, textPath);
        }

        if (typeof textDelta === 'string' && textDelta) {
          if (state.reasoningState.active) {
            state.reasoningState = finalizeReasoning(state.reasoningState, eventBus);
          }
          state.fullReply += textDelta;
          eventBus.emit('chunk', textDelta);
        }

        // Всегда передаём объект в общий обработчик (для истории, reasoning, saveToContext)
        state = processStreamChunk(obj, op, context, state, eventBus, {
          onTrace,
          eventType: obj.type,
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
      lastEvent,
      reasoningText: state.reasoningState.fullText,
      context,
    };
  } finally {
    reader.releaseLock();
  }
}
