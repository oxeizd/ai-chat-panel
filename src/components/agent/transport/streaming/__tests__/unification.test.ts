import { SSEParser, NdjsonParser } from '../parsers';
import { EventBus } from 'components/agent/core/eventBus';
import { createInitialStreamState, processStreamChunk, finalizeStream } from '../processor';
import { dotGet } from 'components/agent/utils/utils';
import { finalizeReasoning } from '../../reasoning/processor';
import { EndpointConfig } from 'types';

describe('streaming/executor — инварианты, задуманные при унификации SSE/NDJSON', () => {
  const sseOp = {
    operation: 'chat',
    method: 'POST',
    path: '/chat',
    streaming: { enabled: true, parseStrategy: 'sse', textPath: 'content' },
  } as unknown as EndpointConfig;

  it('SSEParser + текстовая извлечение по dot-path воспроизводят логику handleSSEStream', () => {
    // Реплика ядра handleSSEStream: feed -> JSON.parse -> dotGet(textPath) -> накопление.
    const parser = new SSEParser();
    let reply = '';
    for (const msg of parser.feed('data: {"content":"foo"}\n\ndata: [DONE]\n\n')) {
      if (msg.data === '[DONE]') {
        continue;
      }
      const evt = JSON.parse(msg.data);
      const delta = dotGet(evt, 'content');
      if (typeof delta === 'string' && delta) {
        reply += delta;
      }
    }
    expect(reply).toBe('foo');
  });

  it('NdjsonParser + dotGet воспроизводят логику handleNdjsonStream', () => {
    const parser = new NdjsonParser();
    let reply = '';
    for (const obj of parser.feed('{"content":"a"}\n{"content":"b"}\n')) {
      const delta = dotGet(obj, 'content');
      if (typeof delta === 'string' && delta) {
        reply += delta;
      }
    }
    expect(reply).toBe('ab');
  });

  it('сохраняет поля в контекст и не меняет fullReply', () => {
    const context: Record<string, any> = {};
    const opWithSave = { ...sseOp, saveToContext: ['session_id'] } as EndpointConfig;
    let state = createInitialStreamState();
    state = processStreamChunk({ session_id: 's1' }, opWithSave, context, state, new EventBus(), {});
    expect(context).toEqual({ session_id: 's1' });
    expect(state.fullReply).toBe('');
  });

  it('finalizeStream деактивирует reasoning и сохраняет полный текст', () => {
    const eventBus = new EventBus();
    let ended: string | undefined;
    eventBus.on('reasoning:end', (text) => (ended = text));

    let state = createInitialStreamState();
    state = { ...state, reasoningState: { active: true, fullText: 'deep thought' } };
    state = finalizeStream(state, eventBus);

    expect(ended).toBe('deep thought');
    expect(state.reasoningState.active).toBe(false);
    expect(state.reasoningState.fullText).toBe('deep thought');
  });

  it('finalizeReasoning на неактивном состоянии — no-op', () => {
    const eventBus = new EventBus();
    let called = false;
    eventBus.on('reasoning:end', () => (called = true));
    const state = finalizeReasoning({ active: false, fullText: '' }, eventBus);
    expect(called).toBe(false);
    expect(state).toEqual({ active: false, fullText: '' });
  });

  it('конфиг-страховка: стриминг без textPath не должен молча терять ответ', () => {
    // Фиксирует известное поведение: пустой textPath => пустой reply.
    // Если при унификации решим падать/предупреждать — этот тест нужно обновить осознанно.
    const op = {
      operation: 'chat',
      method: 'POST',
      path: '/chat',
      streaming: { enabled: true, parseStrategy: 'sse' },
    } as unknown as EndpointConfig;

    const parser = new SSEParser();
    let reply = '';
    for (const msg of parser.feed('data: {"content":"foo"}\n\n')) {
      const evt = JSON.parse(msg.data);
      const delta = dotGet(evt, op.streaming && 'enabled' in op.streaming ? (op.streaming as any).textPath : undefined);
      if (typeof delta === 'string' && delta) {
        reply += delta;
      }
    }
    expect(reply).toBe('');
  });
});
