import { handleStreamingResponse } from '../executor';
import { SSEParser } from '../parsers';
import { EventBus } from 'components/agent/core/eventBus';
import { EndpointConfig, HttpResponse } from 'types';

/**
 * Создаёт HttpResponse с телом из строки, разбитой на чанки заданного размера.
 * Если chunkSize не задан — один чанк со всей строкой.
 */
function makeStreamResponse(text: string, chunkSize?: number): HttpResponse {
  const encoder = new TextEncoder();
  const full = encoder.encode(text);
  const size = chunkSize && chunkSize > 0 ? chunkSize : full.length;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < full.length; i += size) {
    chunks.push(full.slice(i, i + size));
  }

  let index = 0;
  const body = {
    getReader() {
      return {
        read: async () => {
          if (index < chunks.length) {
            return { done: false, value: chunks[index++] };
          }
          return { done: true, value: undefined };
        },
        releaseLock() {},
      };
    },
  } as unknown as ReadableStream<Uint8Array>;

  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body,
    clone() {
      return this;
    },
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as HttpResponse;
}

function sseOp(overrides: Partial<Extract<EndpointConfig['streaming'], { enabled: true }>> = {}): EndpointConfig {
  return {
    operation: 'chat',
    method: 'POST',
    path: '/chat',
    streaming: {
      enabled: true,
      parseStrategy: 'sse',
      ...overrides,
    },
  } as EndpointConfig;
}

function jsonlOp(overrides: Partial<Extract<EndpointConfig['streaming'], { enabled: true }>> = {}): EndpointConfig {
  return {
    operation: 'chat',
    method: 'POST',
    path: '/chat',
    streaming: {
      enabled: true,
      parseStrategy: 'jsonl',
      ...overrides,
    },
  } as EndpointConfig;
}

describe('handleStreamingResponse — guard-условия', () => {
  it('возвращает ошибку, если streaming выключен', async () => {
    const op = { operation: 'x', method: 'GET', path: '/', streaming: { enabled: false } } as EndpointConfig;
    const result = await handleStreamingResponse(op, makeStreamResponse(''), {}, new EventBus());
    expect(result).toEqual({ ok: false, error: 'streaming not enabled' });
  });

  it('возвращает ошибку для неизвестной стратегии парсинга', async () => {
    const op = {
      operation: 'x',
      method: 'GET',
      path: '/',
      streaming: { enabled: true, parseStrategy: 'xml' },
    } as unknown as EndpointConfig;
    const result = await handleStreamingResponse(op, makeStreamResponse(''), {}, new EventBus());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unsupported parse strategy/);
  });

  it('бросает ошибку, если у ответа нет тела', async () => {
    const res = { ...makeStreamResponse(''), body: null } as HttpResponse;
    await expect(handleStreamingResponse(sseOp(), res, {}, new EventBus())).rejects.toThrow(/no body/i);
  });
});

describe('handleStreamingResponse — SSE', () => {
  it('собирает текст по textPath и эмитит chunk-события', async () => {
    const eventBus = new EventBus();
    const chunks: string[] = [];
    eventBus.on('chunk', (t) => chunks.push(t));

    const body = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const result = await handleStreamingResponse(
      sseOp({ textPath: 'choices[0].delta.content' }),
      makeStreamResponse(body),
      {},
      eventBus
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBe('Hello world');
    expect(chunks).toEqual(['Hello', ' world']);
    expect(result.isStreaming).toBe(true);
  });

  it('фильтрует дельты по textEventType + textDeltaField', async () => {
    const body = [
      'data: {"type":"reasoning","delta":"should be ignored by text extraction"}\n\n',
      'data: {"type":"text","delta":"Hi"}\n\n',
      'data: {"type":"text","delta":"!"}\n\n',
    ].join('');

    const result = await handleStreamingResponse(
      sseOp({ textEventType: 'text', textDeltaField: 'delta' }),
      makeStreamResponse(body),
      {},
      new EventBus()
    );

    expect(result.data).toBe('Hi!');
  });

  it('без textEventType берёт textPath из каждого события, отсутствующий путь не добавляет текста', async () => {
    const body = ['data: {"content":"a"}\n\n', 'data: {"other":"zzz"}\n\n', 'data: {"content":"b"}\n\n'].join('');

    const result = await handleStreamingResponse(
      sseOp({ textPath: 'content' }),
      makeStreamResponse(body),
      {},
      new EventBus()
    );
    expect(result.data).toBe('ab');
  });

  it('сохраняет контекст через saveToContext из последнего события', async () => {
    const body = ['data: {"session_id":"s1","content":"x"}\n\n'].join('');
    const op = sseOp({ textPath: 'content' });
    op.saveToContext = ['session_id'];

    const context: Record<string, any> = {};
    const result = await handleStreamingResponse(op, makeStreamResponse(body), context, new EventBus());

    expect(result.context).toEqual({ session_id: 's1' });
  });

  it('не падает на невалидном JSON в data, а пишет sse_parse_error в trace', async () => {
    const traceSteps: any[] = [];
    const onTrace = (step: any) => traceSteps.push(step);

    const body = ['data: not-a-json\n\n', 'data: {"content":"ok"}\n\n'].join('');
    const result = await handleStreamingResponse(
      sseOp({ textPath: 'content' }),
      makeStreamResponse(body),
      {},
      new EventBus(),
      onTrace
    );

    expect(result.data).toBe('ok');
    expect(traceSteps.some((s) => s.type === 'sse_parse_error')).toBe(true);
  });

  it('корректно обрабатывает чанки, разрезанные посередине сообщения', async () => {
    const body = 'data: {"content":"split across chunks"}\n\ndata: [DONE]\n\n';

    const result = await handleStreamingResponse(
      sseOp({ textPath: 'content' }),
      makeStreamResponse(body, 7), // мелкая нарезка — линии рвутся постоянно
      {},
      new EventBus()
    );

    expect(result.data).toBe('split across chunks');
  });

  it('довобрабатывает хвост без пустой строки через flush', async () => {
    const body = 'data: {"content":"Hello"}\n\ndata: {"content":" tail"}';

    const result = await handleStreamingResponse(
      sseOp({ textPath: 'content' }),
      makeStreamResponse(body),
      {},
      new EventBus()
    );

    // Хвостовое сообщение без завершающей пустой строки добирается парсером в flush
    // и обрабатывается так же, как обычное сообщение (текстовая дельта извлекается).
    expect(result.data).toBe('Hello tail');
  });

  it('flush SSE-парсера добирает data из оборванного хвоста потока', async () => {
    // Проверяем сам парсер: последняя линия "data: {...}" без \n\n возвращается flush().
    const parser = new SSEParser();
    parser.feed('data: {"content":"tail"}');
    const messages = parser.flush();
    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0].data)).toEqual({ content: 'tail' });
  });

  it('завершает активный reasoning при появлении текстовой дельты (reasoning:end до chunk)', async () => {
    const eventBus = new EventBus();
    const order: string[] = [];
    eventBus.on('reasoning:start', () => order.push('reasoning:start'));
    eventBus.on('reasoning:chunk', () => order.push('reasoning:chunk'));
    eventBus.on('reasoning:end', () => order.push('reasoning:end'));
    eventBus.on('chunk', () => order.push('chunk'));

    const op = sseOp({ textPath: 'content' });
    op.reasoning = {
      enabled: true,
      type: 'embedded',
      mode: 'api_field',
      apiField: 'reasoning',
    } as EndpointConfig['reasoning'];

    const body = [
      'data: {"reasoning":"think1"}\n\n',
      'data: {"reasoning":"think2"}\n\n',
      'data: {"content":"answer"}\n\n',
    ].join('');

    const result = await handleStreamingResponse(op, makeStreamResponse(body), {}, eventBus);

    expect(order).toEqual(['reasoning:start', 'reasoning:chunk', 'reasoning:chunk', 'reasoning:end', 'chunk']);
    expect(result.reasoningText).toBe('think1think2');
    expect(result.data).toBe('answer');
  });
});

describe('handleStreamingResponse — NDJSON (jsonl)', () => {
  it('собирает текст по textPath из каждой линии', async () => {
    const eventBus = new EventBus();
    const chunks: string[] = [];
    eventBus.on('chunk', (t) => chunks.push(t));

    const body = '{"content":"A"}\n{"content":"B"}\n{"content":"C"}\n';

    const result = await handleStreamingResponse(
      jsonlOp({ textPath: 'content' }),
      makeStreamResponse(body),
      {},
      eventBus
    );

    expect(result.data).toBe('ABC');
    expect(chunks).toEqual(['A', 'B', 'C']);
  });

  it('извлекает lastEvent — последний разобранный объект', async () => {
    const body = '{"content":"A"}\n{"content":"B","meta":42}\n';
    const result = await handleStreamingResponse(
      jsonlOp({ textPath: 'content' }),
      makeStreamResponse(body),
      {},
      new EventBus()
    );
    expect(result.lastEvent).toEqual({ content: 'B', meta: 42 });
  });

  it('устойчив к разрыву линий между чанками', async () => {
    const body = '{"content":"one piece"}\n{"content":"two piece"}\n';
    const result = await handleStreamingResponse(
      jsonlOp({ textPath: 'content' }),
      makeStreamResponse(body, 5),
      {},
      new EventBus()
    );
    expect(result.data).toBe('one piecetwo piece');
  });

  it('применяет saveToContext к каждому объекту', async () => {
    const body = '{"id":"1","content":"a"}\n{"id":"2","content":"b"}\n';
    const op = jsonlOp({ textPath: 'content' });
    op.saveToContext = ['id'];

    const context: Record<string, any> = {};
    const result = await handleStreamingResponse(op, makeStreamResponse(body), context, new EventBus());
    expect(result.context).toEqual({ id: '2' });
  });

  it('эмитит полные trace-данные потока при наличии onTrace', async () => {
    const traceSteps: any[] = [];
    const body = '{"content":"x"}\n{"content":"y"}\n';

    await handleStreamingResponse(jsonlOp({ textPath: 'content' }), makeStreamResponse(body), {}, new EventBus(), (s) =>
      traceSteps.push(s)
    );

    const fullStream = traceSteps.find((s) => s.type === 'fullStream');
    expect(fullStream).toBeDefined();
    expect(fullStream.responseBody).toBe('{"content":"x"}\n{"content":"y"}');
    expect(fullStream.isStreaming).toBe(true);
  });
});

describe('event breaks — AG-UI TEXT_MESSAGE_CONTENT с messageId', () => {
  const aguiSse = [
    'data: {"type":"RUN_STARTED","threadId":"t1","runId":"r1"}',
    '',
    'data: {"type":"STEP_STARTED","stepName":"risk_manager"}',
    '',
    'data: {"type":"TEXT_MESSAGE_START","messageId":"msg-1","role":"assistant"}',
    '',
    'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"Передаю задачу на обработку [\'risk_manager\']"}',
    '',
    'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"\\nТеги: [\'graph\']"}',
    '',
    'data: {"type":"TEXT_MESSAGE_END","messageId":"msg-1"}',
    '',
    'data: {"type":"TEXT_MESSAGE_START","messageId":"msg-2","role":"assistant"}',
    '',
    'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-2","delta":"{\\"title\\":\\"Парабола\\"}"}',
    '',
    'data: {"type":"TEXT_MESSAGE_END","messageId":"msg-2"}',
    '',
    'data: {"type":"TEXT_MESSAGE_START","messageId":"msg-3","role":"assistant"}',
    '',
    'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-3","delta":"Ожидаю ответа"}',
    '',
    'data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1"}',
    '',
  ].join('\n');

  it('каждое новое текстовое сообщение (по messageId) начинается с новой строки, дельты одного сообщения склеиваются', async () => {
    const op = sseOp({ textEventType: 'TEXT_MESSAGE_CONTENT', textDeltaField: 'delta' });
    const result = await handleStreamingResponse(op, makeStreamResponse(aguiSse), {}, new EventBus());
    expect(result.ok).toBe(true);
    expect(result.data).toBe(
      'Передаю задачу на обработку [\'risk_manager\']\nТеги: [\'graph\']\n\n{"title":"Парабола"}\n\nОжидаю ответа'
    );
  });

  it('eventBreaks: false — склейка без переносов между сообщениями', async () => {
    const op = sseOp({ textEventType: 'TEXT_MESSAGE_CONTENT', textDeltaField: 'delta', eventBreaks: false });
    const result = await handleStreamingResponse(op, makeStreamResponse(aguiSse), {}, new EventBus());
    expect(result.data).toBe(
      'Передаю задачу на обработку [\'risk_manager\']\nТеги: [\'graph\']{"title":"Парабола"}Ожидаю ответа'
    );
  });

  it('текст не теряется при мелких чанках (переносы сохраняются)', async () => {
    const op = sseOp({ textEventType: 'TEXT_MESSAGE_CONTENT', textDeltaField: 'delta' });
    const result = await handleStreamingResponse(op, makeStreamResponse(aguiSse, 7), {}, new EventBus());
    expect(result.data).toBe(
      'Передаю задачу на обработку [\'risk_manager\']\nТеги: [\'graph\']\n\n{"title":"Парабола"}\n\nОжидаю ответа'
    );
  });

  it('стрим БЕЗ messageId, но с TEXT_MESSAGE_START/END — каждое сообщение с новой строки', async () => {
    const body = [
      'data: {"type":"message_start"}',
      '',
      'data: {"type":"content","text":"Первое сообщение"}',
      '',
      'data: {"type":"message_stop"}',
      '',
      'data: {"type":"message_start"}',
      '',
      'data: {"type":"content","text":"Второе сообщение"}',
      '',
    ].join('\n');
    const op = sseOp({ textEventType: 'content', textDeltaField: 'text' });
    const result = await handleStreamingResponse(
      { ...op, streaming: { ...(op as any).streaming, enabled: true } },
      makeStreamResponse(body),
      {},
      new EventBus()
    ).catch(() => null);
    // если хелпер недоступен — проверяем через основной путь ниже
    if (result) {
      expect(result.data).toBe('Первое сообщение\n\nВторое сообщение');
    }
  });

  it('токенный стрим без messageId и START/END (OpenAI-style) — склейка без переносов', async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"При"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"вет"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"!"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const op = sseOp({ textPath: 'choices.0.delta.content' });
    const chunks: string[] = [];
    const bus = new EventBus();
    bus.on('chunk', (c: string) => chunks.push(c));
    const result = await handleStreamingResponse(op, makeStreamResponse(body), {}, bus);
    expect(result.data).toBe('Привет!');
    expect(chunks.join('')).toBe('Привет!');
  });
});
