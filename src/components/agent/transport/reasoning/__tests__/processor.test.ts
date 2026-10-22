import { EventBus } from 'components/agent/core/eventBus';
import { createInitialReasoningState, finalizeReasoning, processReasoningChunk, extractReasoningFromFullResponse } from '../processor';
import { ReasoningConfig } from 'types';

const embeddedApiField = {
  enabled: true,
  type: 'embedded',
  mode: 'api_field',
  apiField: 'r.delta',
} as ReasoningConfig;

const separateCfg = {
  enabled: true,
  type: 'separate',
  eventType: 'thinking',
  contentField: 'text',
  resultField: 'state',
} as ReasoningConfig;

describe('reasoning processor — начальное состояние и финализация', () => {
  it('createInitialReasoningState пустое и неактивное', () => {
    expect(createInitialReasoningState()).toEqual({ active: false, fullText: '' });
  });

  it('finalizeReasoning эмитит reasoning:end только для активного состояния', () => {
    const bus = new EventBus();
    let endCount = 0;
    bus.on('reasoning:end', () => endCount++);

    finalizeReasoning({ active: true, fullText: 'x' }, bus);
    finalizeReasoning({ active: false, fullText: 'y' }, bus);
    expect(endCount).toBe(1);
  });
});

describe('processReasoningChunk — embedded/api_field', () => {
  it('на первом чанке эмитит start, далее chunk; накапливает fullText', () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('reasoning:start', () => events.push('start'));
    bus.on('reasoning:chunk', (t) => events.push(`chunk:${t}`));

    let state = createInitialReasoningState();
    state = processReasoningChunk({ r: { delta: 'aa' } }, embeddedApiField, state, bus);
    state = processReasoningChunk({ r: { delta: 'bb' } }, embeddedApiField, state, bus);

    expect(events).toEqual(['start', 'chunk:aa', 'chunk:bb']);
    expect(state).toEqual({ active: true, fullText: 'aabb' });
  });

  it('чанк без строки в apiField игнорируется', () => {
    const bus = new EventBus();
    let emitted = false;
    bus.on('reasoning:start', () => (emitted = true));
    const state = processReasoningChunk({ other: 1 }, embeddedApiField, createInitialReasoningState(), bus);
    expect(emitted).toBe(false);
    expect(state.active).toBe(false);
  });

  it('выключенный конфиг — no-op', () => {
    const off = { enabled: false } as ReasoningConfig;
    const state = processReasoningChunk({ r: { delta: 'x' } }, off, createInitialReasoningState(), new EventBus());
    expect(state).toEqual({ active: false, fullText: '' });
  });
});

describe('processReasoningChunk — separate', () => {
  it('берёт чанки только с совпадающим eventType', () => {
    const bus = new EventBus();
    const chunks: string[] = [];
    bus.on('reasoning:chunk', (t) => chunks.push(t));

    let state = createInitialReasoningState();
    state = processReasoningChunk({ text: 'nope' }, separateCfg, state, bus, undefined, 'other');
    state = processReasoningChunk({ text: 'yes' }, separateCfg, state, bus, undefined, 'thinking');

    expect(chunks).toEqual(['yes']);
    expect(state.fullText).toBe('yes');
  });

  it('resultField со значением, содержащим "end", закрывает секцию', () => {
    const bus = new EventBus();
    let endedWith: string | undefined;
    bus.on('reasoning:end', (t) => (endedWith = t));

    let state = createInitialReasoningState();
    state = processReasoningChunk({ text: 'deep', state: 'RUNNING' }, separateCfg, state, bus, undefined, 'thinking');
    expect(state.active).toBe(true);
    state = processReasoningChunk({ text: '!', state: 'END_OF_THOUGHT' }, separateCfg, state, bus, undefined, 'thinking');

    expect(endedWith).toBe('deep!');
    expect(state.active).toBe(false);
  });

  it('без настроенного eventType ничего не делает', () => {
    const cfg = { enabled: true, type: 'separate', contentField: 'text' } as ReasoningConfig;
    const state = processReasoningChunk({ text: 'x' }, cfg, createInitialReasoningState(), new EventBus(), undefined, 'anything');
    expect(state.active).toBe(false);
  });
});

describe('extractReasoningFromFullResponse — thinking_tags', () => {
  const tagCfg = {
    enabled: true,
    type: 'embedded',
    mode: 'thinking_tags',
    startMarker: '<thinking>',
    endMarker: '</thinking>',
  } as ReasoningConfig;

  it('вырезает маркеры из reply и эмитит полный цикл событий', () => {
    const bus = new EventBus();
    const seq: string[] = [];
    bus.on('reasoning:start', () => seq.push('start'));
    bus.on('reasoning:chunk', (t) => seq.push(`chunk:${t}`));
    bus.on('reasoning:end', () => seq.push('end'));

    const { cleanedReply, extracted } = extractReasoningFromFullResponse(
      null,
      'Before <thinking>hidden thought</thinking> after',
      tagCfg,
      bus
    );

    expect(extracted).toBe(true);
    expect(cleanedReply).toBe('Before  after');
    expect(seq).toEqual(['start', 'chunk:hidden thought', 'end']);
  });

  it('без маркеров reply не меняется и ничего не эмитится', () => {
    const bus = new EventBus();
    let any = false;
    bus.on('reasoning:start', () => (any = true));
    const res = extractReasoningFromFullResponse(null, 'plain text', tagCfg, bus);
    expect(res).toEqual({ cleanedReply: 'plain text', extracted: false });
    expect(any).toBe(false);
  });

  it('перевёрнутые маркеры (end раньше start) игнорируются', () => {
    const res = extractReasoningFromFullResponse(
      null,
      '</thinking> oops <thinking>',
      tagCfg,
      new EventBus()
    );
    expect(res.extracted).toBe(false);
    expect(res.cleanedReply).toBe('</thinking> oops <thinking>');
  });

  it('дефолтные маркеры берутся из DEFAULT_REASONING, если не заданы', () => {
    const cfg = { enabled: true, type: 'embedded', mode: 'thinking_tags' } as ReasoningConfig;
    const res = extractReasoningFromFullResponse(null, 'a<thinking>t</thinking>b', cfg, new EventBus());
    expect(res.extracted).toBe(true);
    expect(res.cleanedReply).toBe('ab');
  });
});

describe('extractReasoningFromFullResponse — api_field / separate final', () => {
  it('embedded api_field извлекает reasoning из тела ответа', () => {
    const bus = new EventBus();
    let chunk: string | undefined;
    bus.on('reasoning:chunk', (t) => (chunk = t));

    const body = { choices: [{ message: { content: 'answer', reasoning: 'because...' } }] };
    const res = extractReasoningFromFullResponse(body, 'answer', embeddedApiFieldFinal(), bus);

    expect(res.extracted).toBe(true);
    expect(chunk).toBe('because...');
    expect(res.cleanedReply).toBe('answer');
  });

  it('separate извлекает по contentField', () => {
    const cfg = { enabled: true, type: 'separate', contentField: 'thoughts' } as ReasoningConfig;
    const res = extractReasoningFromFullResponse({ thoughts: 'why' }, 'reply', cfg, new EventBus());
    expect(res).toEqual({ cleanedReply: 'reply', extracted: true });
  });

  function embeddedApiFieldFinal(): ReasoningConfig {
    return {
      enabled: true,
      type: 'embedded',
      mode: 'api_field',
      apiField: 'choices[0].message.reasoning',
    } as ReasoningConfig;
  }
});
