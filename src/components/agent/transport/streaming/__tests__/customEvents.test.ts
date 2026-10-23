import {
  matchCustomEventHandler,
  applyCustomEventHandler,
  normalizeChartData,
} from '../customEvents';
import { appendTextDelta, createInitialStreamState, processCustomEvent } from '../processor';
import { EventBus } from 'components/agent/core/eventBus';
import type { EndpointConfig, StreamEventHandler } from 'types';

describe('matchCustomEventHandler', () => {
  const rules: StreamEventHandler[] = [
    { eventType: 'CUSTOM', eventName: 'graph', render: 'chart' },
    { eventType: 'CUSTOM', render: 'context', valuePath: 'value', contextKey: 'dataset' },
    { eventType: 'RUN_ERROR', render: 'error' },
  ];

  it('матчит по типу и имени (первое подходящее правило)', () => {
    const ev = { type: 'CUSTOM', name: 'graph', value: { datasets: [] } };
    expect(matchCustomEventHandler(ev, rules)).toBe(rules[0]);
  });

  it('без имени матчит следующее правило того же типа', () => {
    const ev = { type: 'CUSTOM', name: 'dataset', value: [{ x: 1, y: 2 }] };
    expect(matchCustomEventHandler(ev, rules)).toBe(rules[1]);
  });

  it('матчит RUN_ERROR', () => {
    const ev = { type: 'RUN_ERROR', message: 'boom' };
    expect(matchCustomEventHandler(ev, rules)).toBe(rules[2]);
  });

  it('не матчит неизвестный тип и пустые правила', () => {
    expect(matchCustomEventHandler({ type: 'STEP_STARTED' }, rules)).toBeNull();
    expect(matchCustomEventHandler({ type: 'CUSTOM' }, undefined)).toBeNull();
    expect(matchCustomEventHandler(null, rules)).toBeNull();
  });

  it('учитывает кастомные eventTypeField/nameField', () => {
    const r: StreamEventHandler[] = [
      { eventType: 'graph', render: 'chart', eventTypeField: 'kind', nameField: 'sub' , eventName: 'line' },
    ];
    expect(matchCustomEventHandler({ kind: 'graph', sub: 'line' }, r)).toBe(r[0]);
    expect(matchCustomEventHandler({ kind: 'graph', sub: 'bar' }, r)).toBeNull();
  });
});

describe('applyCustomEventHandler', () => {
  it('chart: извлекает по valuePath и нормализует', () => {
    const ev = {
      type: 'CUSTOM',
      name: 'graph',
      value: {
        type: 'line',
        labels: ['1', '2'],
        datasets: [{ label: 'y', data: [1, 4] }],
        title: 'T',
      },
    };
    const res = applyCustomEventHandler(ev, { eventType: 'CUSTOM', eventName: 'graph', render: 'chart' })!;
    expect(res.chart).toBeTruthy();
    expect(res.chart!.title).toBe('T');
    expect(res.chart!.datasets![0].data).toEqual([1, 4]);
  });

  it('chart wholeEvent: берёт событие целиком', () => {
    const ev = { type: 'graph', labels: ['a'], datasets: [{ data: [1] }] };
    const res = applyCustomEventHandler(ev, { eventType: 'graph', render: 'chart', wholeEvent: true })!;
    expect(res.chart?.datasets?.[0].data).toEqual([1]);
  });

  it('text: строка как есть, paragraph по умолчанию true', () => {
    const res = applyCustomEventHandler({ type: 'CUSTOM', value: 'hi' }, {
      eventType: 'CUSTOM', render: 'text',
    })!;
    expect(res.text).toBe('hi');
    expect(res.paragraph).toBe(true);
  });

  it('code: оборачивает в fenced блок с языком', () => {
    const res = applyCustomEventHandler({ type: 'CUSTOM', value: { a: 1 } }, {
      eventType: 'CUSTOM', render: 'code', language: 'json',
    })!;
    expect(res.text).toContain('```json');
    expect(res.text).toContain('"a": 1');
  });

  it('context: требует contextKey, кладёт значение по ключу', () => {
    const ev = { type: 'CUSTOM', name: 'dataset', value: [{ x: 1, y: 1 }] };
    const res = applyCustomEventHandler(ev, {
      eventType: 'CUSTOM', eventName: 'dataset', render: 'context', contextKey: 'dataset',
    })!;
    expect(res.contextUpdate).toEqual({ dataset: ev.value });
    expect(applyCustomEventHandler(ev, { eventType: 'CUSTOM', render: 'context' })).toBeNull();
  });

  it('error: message из события, иначе fallback', () => {
    expect(applyCustomEventHandler({ type: 'RUN_ERROR', message: 'truncated' }, {
      eventType: 'RUN_ERROR', render: 'error',
    })!.error).toBe('truncated');
    expect(applyCustomEventHandler({ type: 'RUN_ERROR' }, {
      eventType: 'RUN_ERROR', render: 'error', errorMessage: 'Stream error',
    })!.error).toBe('Stream error');
  });

  it('ignore → null', () => {
    expect(applyCustomEventHandler({ type: 'X' }, { eventType: 'X', render: 'ignore' })).toBeNull();
  });
});

describe('normalizeChartData', () => {
  it('формат AG-UI {type,title,data:[{x,y}],xAxis,yAxis}', () => {
    const c = normalizeChartData({
      type: 'line',
      title: 'Парабола y = x²',
      data: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }],
      xAxis: 'x',
      yAxis: 'y',
    })!;
    expect(c.type).toBe('line');
    expect(c.title).toBe('Парабола y = x²');
    expect(c.labels).toEqual(['0', '1', '2']);
    expect(c.datasets![0].data).toEqual([0, 1, 4]);
    expect(c.xAxisTitle).toBe('x');
    expect(c.yAxisTitle).toBe('y');
  });

  it('вложенный chart (старый формат CUSTOM)', () => {
    const c = normalizeChartData({
      type: 'CUSTOM',
      chart: { type: 'line', title: 'P', data: [{ x: 1, y: 1 }], xAxis: 'x', yAxis: 'y' },
    })!;
    expect(c.title).toBe('P');
  });

  it('готовый Chart.js конфиг проходит насквозь', () => {
    const c = normalizeChartData({
      type: 'bar',
      labels: ['a', 'b'],
      datasets: [{ label: 's', data: [3, 4] }],
      height: 400,
    })!;
    expect(c.type).toBe('bar');
    expect(c.height).toBe(400);
  });

  it('массив точек и массив чисел', () => {
    expect(normalizeChartData([{ x: 1, y: 2 }])!.datasets![0].data).toEqual([2]);
    const nums = normalizeChartData([1, 2, 3])!;
    expect(nums.data).toEqual([1, 2, 3]);
  });

  it('null для мусора', () => {
    expect(normalizeChartData(null)).toBeNull();
    expect(normalizeChartData('str')).toBeNull();
    expect(normalizeChartData([])).toBeNull();
    expect(normalizeChartData({ foo: 1 })).toBeNull();
  });
});

describe('appendTextDelta — склейка сообщений', () => {
  function run(deltas: Array<{ text: string; messageId?: string }>, paragraph = true) {
    const bus = new EventBus();
    const chunks: string[] = [];
    bus.on('chunk', (t: string) => chunks.push(t));
    let state = createInitialStreamState();
    for (const d of deltas) {
      state = appendTextDelta(state, d.text, bus, { paragraphBetweenMessages: paragraph, messageId: d.messageId });
    }
    return { state, chunks };
  }

  it('вставляет \\n\\n при смене messageId (нет склейки «помочь?Генерирую...»)', () => {
    const { state } = run([
      { text: 'Привет! Я AG-UI бот. Чем могу помочь?', messageId: 'msg-1' },
      { text: 'Генерирую данные для графика...', messageId: 'msg-2' },
    ]);
    expect(state.fullReply).toBe('Привет! Я AG-UI бот. Чем могу помочь?\n\nГенерирую данные для графика...');
  });

  it('не дублирует разделитель внутри одного сообщения', () => {
    const { state } = run([
      { text: 'AA', messageId: 'msg-1' },
      { text: 'BB', messageId: 'msg-1' },
    ]);
    expect(state.fullReply).toBe('AABB');
  });

  it('сохраняет пробельные дельты (сервер может явно слать "\\n\\n")', () => {
    const { state } = run([
      { text: 'Данные персистированы.', messageId: 'msg-1' },
      { text: '\n\n', messageId: 'msg-2' },
      { text: 'График готов', messageId: 'msg-3' },
    ]);
    // msg-2 дельта сама по себе перевод строк; перед msg-3 ещё один абзац
    expect(state.fullReply).toBe('Данные персистированы.\n\n\n\nГрафик готов');
    expect(state.hasText).toBe(true);
  });

  it('paragraphBetweenMessages=false отключает разделитель', () => {
    const { state } = run(
      [
        { text: 'AA', messageId: 'msg-1' },
        { text: 'BB', messageId: 'msg-2' },
      ],
      false
    );
    expect(state.fullReply).toBe('AABB');
  });
});

describe('processCustomEvent', () => {
  function opWithRules(rules: StreamEventHandler[]): EndpointConfig {
    return {
      operation: 'chat',
      method: 'POST',
      path: '/c',
      streaming: { enabled: true, parseStrategy: 'sse', customEvents: rules },
    } as unknown as EndpointConfig;
  }

  it('chart: кладёт в state.charts и эмитит событие chart', () => {
    const bus = new EventBus();
    const charts: any[] = [];
    bus.on('chart', (c: any) => charts.push(c));
    let state = createInitialStreamState();
    state = processCustomEvent(
      { type: 'CUSTOM', name: 'graph', value: { labels: ['1'], datasets: [{ data: [1] }] } },
      opWithRules([{ eventType: 'CUSTOM', eventName: 'graph', render: 'chart' }]),
      state,
      bus
    );
    expect(state.charts).toHaveLength(1);
    expect(charts).toHaveLength(1);
  });

  it('error: фиксирует streamError', () => {
    const bus = new EventBus();
    let state = createInitialStreamState();
    state = processCustomEvent(
      { type: 'RUN_ERROR', message: 'LLM response truncated' },
      opWithRules([{ eventType: 'RUN_ERROR', render: 'error' }]),
      state,
      bus
    );
    expect(state.streamError).toBe('LLM response truncated');
  });

  it('context: накапливает pendingContext', () => {
    const bus = new EventBus();
    let state = createInitialStreamState();
    state = processCustomEvent(
      { type: 'CUSTOM', name: 'dataset', value: [{ x: 1, y: 1 }] },
      opWithRules([
        { eventType: 'CUSTOM', eventName: 'dataset', render: 'context', contextKey: 'dataset_ref' },
      ]),
      state,
      bus
    );
    expect(state.pendingContext.dataset_ref).toEqual([{ x: 1, y: 1 }]);
  });

  it('событие без правила игнорируется', () => {
    const bus = new EventBus();
    let state = createInitialStreamState();
    state = processCustomEvent({ type: 'STEP_STARTED', stepName: 'x' }, opWithRules([]), state, bus);
    expect(state.charts).toHaveLength(0);
    expect(state.streamError).toBeUndefined();
  });

  it('fallback: CUSTOM с chart внутри без правил → ровно один график (форма из спеки AG-UI)', () => {
    const bus = new EventBus();
    const charts: any[] = [];
    bus.on('chart', (c: any) => charts.push(c));
    let state = createInitialStreamState();
    const ev = {
      type: 'CUSTOM',
      chart: {
        type: 'line',
        title: 'График параболы y = x²',
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 4 },
        ],
        xAxis: 'x',
        yAxis: 'y',
      },
    };
    // Правил нет вообще — включается fallback по полю chart.
    state = processCustomEvent(ev, opWithRules([]), state, bus);
    expect(state.charts).toHaveLength(1);
    expect(charts).toHaveLength(1);
    expect(state.charts[0].title).toBe('График параболы y = x²');
    expect(state.charts[0].datasets![0].data).toEqual([0, 1, 4]);
  });

  it('без дублей: правило chart + fallback не срабатывают дважды для одного события', () => {
    const bus = new EventBus();
    const charts: any[] = [];
    bus.on('chart', (c: any) => charts.push(c));
    let state = createInitialStreamState();
    const ev = {
      type: 'CUSTOM',
      wholeEvent: true as never, // просто чтобы событие было валидным объектом
      chart: { type: 'line', data: [{ x: 1, y: 1 }] },
    };
    // Правило матчает CUSTOM целиком (wholeEvent) — fallback выключен, т.к. rules непустые.
    state = processCustomEvent(
      ev,
      opWithRules([{ eventType: 'CUSTOM', render: 'chart', wholeEvent: true }]),
      state,
      bus
    );
    expect(state.charts).toHaveLength(1);
    expect(charts).toHaveLength(1);
  });
});

/**
 * Создаёт HttpResponse с телом из строки, разбитой на чанки заданного размера
 * (проверка устойчивости парсера к разбиению потока).
 */
function makeStreamResponse(text: string, chunkSize: number): import('types').HttpResponse {
  const encoder = new TextEncoder();
  const full = encoder.encode(text);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < full.length; i += chunkSize) {
    chunks.push(full.slice(i, i + chunkSize));
  }
  let index = 0;
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      getReader: () => ({
        read: async () => (index < chunks.length ? { done: false, value: chunks[index++] } : { done: true, value: undefined }),
        releaseLock() {},
      }),
    },
  } as unknown as import('types').HttpResponse;
}

describe('AG-UI e2e через handleStreamingResponse', () => {
  it('полный поток: чарт из CUSTOM graph, отсутствие склейки, ошибка из RUN_ERROR', async () => {
    const { handleStreamingResponse } = await import('../executor');

    const events = [
      { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
      { type: 'TEXT_MESSAGE_START', messageId: 'msg-1', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'Привет! Я AG-UI бот. Чем могу помочь?' },
      { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
      { type: 'TEXT_MESSAGE_START', messageId: 'msg-2', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-2', delta: 'Генерирую данные для графика...' },
      { type: 'TEXT_MESSAGE_END', messageId: 'msg-2' },
      { type: 'CUSTOM', name: 'graph', value: { labels: ['0', '1', '2'], datasets: [{ label: 'y=x^2', data: [0, 1, 4] }] } },
      { type: 'RUN_ERROR', message: 'LLM response truncated (finish_reason=length)' },
    ];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const res = makeStreamResponse(body, 37);

    const op = {
      operation: 'chat',
      method: 'POST',
      path: '/c',
      streaming: {
        enabled: true,
        parseStrategy: 'sse',
        textEventType: 'TEXT_MESSAGE_CONTENT',
        textDeltaField: 'delta',
        customEvents: [
          { eventType: 'CUSTOM', eventName: 'graph', render: 'chart' },
          { eventType: 'RUN_ERROR', render: 'error' },
        ],
      },
    } as unknown as EndpointConfig;

    const result = await handleStreamingResponse(op, res, {}, new EventBus());

    expect(result.ok).toBe(true);
    // без склейки: между сообщениями вставлен пустой абзац
    expect(result.data).toBe('Привет! Я AG-UI бот. Чем могу помочь?\n\nГенерирую данные для графика...');
    // график из CUSTOM события
    expect(result.charts).toHaveLength(1);
    expect(result.charts![0].datasets![0].data).toEqual([0, 1, 4]);
    // ошибка потока проброшена
    expect(result.error).toBe('LLM response truncated (finish_reason=length)');
  });

  it('сервер шлёт "\\n\\n" отдельным сообщением — разделитель не дублируется', async () => {
    const { handleStreamingResponse } = await import('../executor');

    const events = [
      { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Данные персистированы.' },
      { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
      { type: 'TEXT_MESSAGE_START', messageId: 'm2', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm2', delta: '\n\n' },
      { type: 'TEXT_MESSAGE_END', messageId: 'm2' },
      { type: 'TEXT_MESSAGE_START', messageId: 'm3', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm3', delta: 'График готов.' },
      { type: 'TEXT_MESSAGE_END', messageId: 'm3' },
    ];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const res = makeStreamResponse(body, 53);

    const op = {
      operation: 'chat',
      method: 'POST',
      path: '/c',
      streaming: {
        enabled: true,
        parseStrategy: 'sse',
        textEventType: 'TEXT_MESSAGE_CONTENT',
        textDeltaField: 'delta',
      },
    } as unknown as EndpointConfig;

    const result = await handleStreamingResponse(op, res, {}, new EventBus());
    expect(result.data).toBe('Данные персистированы.\n\nГрафик готов.');
  });
});
