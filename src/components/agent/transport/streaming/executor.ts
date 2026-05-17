import { SSEParser, NdjsonParser } from './parsers';
import { EventBus } from 'components/agent/core/eventBus';
import { createInitialStreamState, processStreamChunk, finalizeStream } from './processor';
import { HttpResponse, EndpointConfig, TraceStep, SendResult } from 'types';

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
  } else if (streaming.parseStrategy === 'jsonl') {
    const result = await handleNdjsonStream(op, response, context, eventBus, onTrace);

    return {
      ok: true,
      data: result.reply,
      context: result.context,
      reasoningText: result.reasoningText,
      isStreaming: true,
      lastEvent: result.lastEvent,
    };
  } else {
    return {
      ok: false,
      error: `Unsupported parse strategy: ${streaming.parseStrategy}`,
    };
  }
}

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
  const rawMessages: string[] = [];

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
        rawMessages.push(msg.data);

        if (msg.data === '[DONE]') {
          continue;
        }

        let event: any;
        try {
          event = JSON.parse(msg.data);
          lastEvent = event;
        } catch (e) {
          onTrace?.({
            type: 'sse_parse_error',
            timestamp: Date.now(),
            rawLine: msg.data,
            error: String(e),
          });
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
      } catch {
        // ignore
      }
    }

    state = finalizeStream(state, eventBus);

    onTrace?.({
      type: 'response',
      timestamp: Date.now(),
      responseBody: rawMessages.join('\n'),
    });

    return {
      reply: state.fullReply,
      reasoningText: state.reasoningState.fullText,
      lastEvent: lastEvent,
      context,
    };
  } finally {
    reader.releaseLock();
  }
}

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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const objects = parser.feed(chunk);
      for (const obj of objects) {
        lastEvent = obj;
        state = processStreamChunk(obj, op, context, state, eventBus, { onTrace });
      }
    }

    const finalObjects = parser.flush();
    for (const obj of finalObjects) {
      state = processStreamChunk(obj, op, context, state, eventBus, { onTrace });
    }

    state = finalizeStream(state, eventBus);

    onTrace?.({
      type: 'response',
      timestamp: Date.now(),
      responseBody: state.fullReply,
      isStreaming: true,
    });

    return {
      reply: state.fullReply,
      lastEvent: lastEvent,
      reasoningText: state.reasoningState.fullText,
      context,
    };
  } finally {
    reader.releaseLock();
  }
}
