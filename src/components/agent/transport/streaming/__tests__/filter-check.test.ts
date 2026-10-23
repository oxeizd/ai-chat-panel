import { handleStreamingResponse } from '../executor';
import { EventBus } from 'components/agent/core/eventBus';
import { EndpointConfig, HttpResponse } from 'types';

function makeStreamResponse(text: string): HttpResponse {
  const encoder = new TextEncoder();
  const full = encoder.encode(text);
  let done = false;
  const body = {
    getReader: () => ({
      read: async () => (done ? { done: true, value: undefined } : ((done = true), { done: false, value: full })),
      releaseLock: () => {},
    }),
  } as unknown as ReadableStream<Uint8Array>;
  return { ok: true, status: 200, headers: new Headers(), body } as unknown as HttpResponse;
}

const sseOp = (overrides: Partial<Extract<EndpointConfig['streaming'], { enabled: true }>> = {}): EndpointConfig =>
  ({
    operation: 'chat',
    method: 'POST',
    path: '/chat',
    streaming: { enabled: true, parseStrategy: 'sse', ...overrides },
  }) as EndpointConfig;

describe('фильтрация TEXT_MESSAGE_CONTENT (AG-UI style stream)', () => {
  it('в ответ попадают только delta из TEXT_MESSAGE_CONTENT, другие события игнорируются', async () => {
    const body = [
      'data: {"type":"RUN_STARTED","threadId":"t1"}\n\n',
      'data: {"type":"REASONING_MESSAGE_CONTENT","delta":"это не должно попасть в текст"}\n\n',
      'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"Привет"}\n\n',
      'data: {"type":"CUSTOM","delta":"тоже мимо"}\n\n',
      'data: {"type":"TEXT_MESSAGE_CONTENT","delta":" мир"}\n\n',
      'data: {"type":"RUN_FINISHED","threadId":"t1"}\n\n',
    ].join('');

    const chunks: string[] = [];
    const bus = new EventBus();
    bus.on('chunk', (t) => chunks.push(t));

    const res = await handleStreamingResponse(
      sseOp({ textEventType: 'TEXT_MESSAGE_CONTENT', textDeltaField: 'delta' }),
      makeStreamResponse(body),
      {},
      bus
    );

    expect(res.ok).toBe(true);
    // eventBreaks по умолчанию включен, но без messageId дельты одного типа склеиваются без переноса
    expect(res.data).toBe('Привет мир');
    expect(chunks).toEqual(['Привет', ' мир']);
  });

  it('стримы без messageId (OpenAI-style) склеиваются в один текст без переносов', async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"Привет"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":", мир!"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const res = await handleStreamingResponse(
      sseOp({ textPath: 'choices.0.delta.content' }),
      makeStreamResponse(body),
      {},
      new EventBus()
    );

    expect(res.data).toBe('Привет, мир!');
  });
});
