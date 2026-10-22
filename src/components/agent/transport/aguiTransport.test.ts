import { AGUITransport } from './aguiTransport';
import { EventBus } from '../core/eventBus';
import type { AgentConfig } from 'types';

// Mock fetch
global.fetch = jest.fn();

describe('AGUITransport', () => {
  let transport: AGUITransport;
  let bus: EventBus;
  let mockAgentConfig: AgentConfig;

  beforeEach(() => {
    bus = new EventBus();
    mockAgentConfig = {
      name: 'test-agent',
      url: 'http://localhost:8080/chat',
      default: false,
      endpoints: [],
      workflow: [],
      startupOperation: '',
      history: false,
    } as AgentConfig;

    transport = new AGUITransport(mockAgentConfig, bus);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('parseSSE', () => {
    it('should parse standard SSE events with event: and data: fields', () => {
      const sse = `event: TEXT_MESSAGE_START
data: {"messageId":"msg-1","role":"assistant"}

event: TEXT_MESSAGE_CONTENT
data: {"messageId":"msg-1","delta":"Hello"}

event: TEXT_MESSAGE_END
data: {"messageId":"msg-1"}

`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('TEXT_MESSAGE_START');
      expect(events[0].messageId).toBe('msg-1');
      expect(events[0].role).toBe('assistant');

      expect(events[1].type).toBe('TEXT_MESSAGE_CONTENT');
      expect(events[1].delta).toBe('Hello');

      expect(events[2].type).toBe('TEXT_MESSAGE_END');
    });

    it('should parse SSE events with type in JSON data', () => {
      const sse = `data: {"type":"RUN_STARTED","threadId":"abc-123","runId":"run-456"}

data: {"type":"STEP_STARTED","stepName":"context_refiner"}

`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('RUN_STARTED');
      expect(events[0].threadId).toBe('abc-123');
      expect(events[1].type).toBe('STEP_STARTED');
      expect(events[1].stepName).toBe('context_refiner');
    });

    it('should parse SSE events without prefix (plain JSON)', () => {
      const sse = `{"type":"TEXT_MESSAGE_CONTENT","delta":"world"}

`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
      expect(events[0].delta).toBe('world');
    });

    it('should handle multiple blocks', () => {
      const sse = `event: TEXT_MESSAGE_START
data: {"messageId":"msg-1","role":"assistant"}

event: TEXT_MESSAGE_CONTENT
data: {"messageId":"msg-1","delta":"Hi"}

`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(2);
    });

    it('should skip empty blocks', () => {
      const sse = `


data: {"type":"TEXT_MESSAGE_CONTENT","delta":"test"}


`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
    });

    it('should skip invalid JSON', () => {
      const sse = `data: {invalid json}

data: {"type":"TEXT_MESSAGE_CONTENT","delta":"ok"}

`;

      const events = (transport as any).parseSSE(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TEXT_MESSAGE_CONTENT');
    });

    it('should handle empty buffer', () => {
      const events = (transport as any).parseSSE('');
      expect(events).toHaveLength(0);
    });
  });

  describe('processEvent', () => {
    it('should emit text:chunk trace for TEXT_MESSAGE_CONTENT', () => {
      const traceSteps: any[] = [];

      (transport as any).processEvent(
        { type: 'TEXT_MESSAGE_CONTENT', delta: 'Hello', messageId: 'msg-1' },
        (step: any) => traceSteps.push(step)
      );
      (transport as any).processEvent(
        { type: 'TEXT_MESSAGE_CONTENT', delta: ' World', messageId: 'msg-1' },
        (step: any) => traceSteps.push(step)
      );

      expect(traceSteps).toHaveLength(2);
      expect(traceSteps[0].type).toBe('text:chunk');
      expect(traceSteps[0].delta).toBe('Hello');
      expect(traceSteps[1].type).toBe('text:chunk');
      expect(traceSteps[1].delta).toBe(' World');
    });

    it('should emit reasoning:start, reasoning:chunk, reasoning:end', () => {
      const reasoningChunks: string[] = [];
      bus.on('reasoning:chunk', (chunk: string) => reasoningChunks.push(chunk));

      let reasoningStartFired = false;
      bus.on('reasoning:start', () => {
        reasoningStartFired = true;
      });

      let reasoningEndFired = false;
      bus.on('reasoning:end', () => {
        reasoningEndFired = true;
      });

      (transport as any).processEvent({ type: 'REASONING_START' });
      (transport as any).processEvent({ type: 'REASONING_CONTENT', delta: 'thinking...' });
      (transport as any).processEvent({ type: 'REASONING_END' });

      expect(reasoningStartFired).toBe(true);
      expect(reasoningChunks).toEqual(['thinking...']);
      expect(reasoningEndFired).toBe(true);
    });

    it('should emit contextUpdate for STATE_SNAPSHOT', () => {
      const contextUpdates: any[] = [];
      bus.on('contextUpdate', (ctx: any) => contextUpdates.push(ctx));

      (transport as any).processEvent({
        type: 'STATE_SNAPSHOT',
        snapshot: { thread_id: '123', user_input: 'test' },
      });

      expect(contextUpdates).toHaveLength(1);
      expect(contextUpdates[0]).toEqual({ thread_id: '123', user_input: 'test' });
    });

    it('should emit contextUpdate for STATE_DELTA', () => {
      const contextUpdates: any[] = [];
      bus.on('contextUpdate', (ctx: any) => contextUpdates.push(ctx));

      (transport as any).processEvent({
        type: 'STATE_DELTA',
        delta: { new_key: 'new_value' },
      });

      expect(contextUpdates).toHaveLength(1);
      expect(contextUpdates[0]).toEqual({ new_key: 'new_value' });
    });

    it('should handle custom events (charts, etc.)', () => {
      const customData = { type: 'custom', chart: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] } };
      const traceSteps: any[] = [];

      (transport as any).processEvent(customData, (step: any) => traceSteps.push(step));

      expect(traceSteps).toHaveLength(1);
      expect(traceSteps[0].type).toBe('custom');
      expect(traceSteps[0].data).toEqual(customData);
    });

    it('should log unknown event types', () => {
      const consoleWarn = console.warn;
      console.warn = jest.fn();

      (transport as any).processEvent({ type: 'UNKNOWN_EVENT', foo: 'bar' });

      expect(console.warn).toHaveBeenCalledWith(
        '[AGUITransport] Unknown event type:',
        'UNKNOWN_EVENT',
        expect.objectContaining({ foo: 'bar' })
      );

      console.warn = consoleWarn;
    });
  });

  describe('buildHeaders', () => {
    it('should include default headers', () => {
      const headers = (transport as any).buildHeaders();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('text/event-stream');
    });

    it('should merge endpoint headers', () => {
      mockAgentConfig.endpoints = [
        {
          operation: 'chat',
          method: 'POST',
          path: '/',
          headers: { Authorization: 'Bearer test-token' },
        },
      ];

      const headers = (transport as any).buildHeaders();
      expect(headers['Authorization']).toBe('Bearer test-token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('processEvent — ACTIVITY_SNAPSHOT (AG-UI interactive)', () => {
    it('should emit interactive event for activityType: interactive', () => {
      const interactivePayloads: any[] = [];
      bus.on('interactive', (payload: any) => interactivePayloads.push(payload));

      (transport as any).processEvent({
        type: 'ACTIVITY_SNAPSHOT',
        messageId: 'msg-1',
        activityType: 'interactive',
        content: {
          actions: [{ label: 'Да', value: 'yes' }],
          form: [{ name: 'comment', type: 'text' }],
          submitLabel: 'Отправить',
        },
      });

      expect(interactivePayloads).toHaveLength(1);
      expect(interactivePayloads[0].actions).toEqual([{ label: 'Да', value: 'yes' }]);
      expect(interactivePayloads[0].form).toEqual([{ name: 'comment', type: 'text' }]);
      expect(interactivePayloads[0].submitLabel).toBe('Отправить');
    });

    it('should support old format (options/fields) in ACTIVITY_SNAPSHOT', () => {
      const interactivePayloads: any[] = [];
      bus.on('interactive', (payload: any) => interactivePayloads.push(payload));

      (transport as any).processEvent({
        type: 'ACTIVITY_SNAPSHOT',
        messageId: 'msg-2',
        activityType: 'interactive',
        content: {
          options: [{ label: 'Нет', value: 'no' }],
          fields: [{ name: 'email', type: 'text' }],
        },
      });

      expect(interactivePayloads).toHaveLength(1);
      expect(interactivePayloads[0].actions).toEqual([{ label: 'Нет', value: 'no' }]);
      expect(interactivePayloads[0].form).toEqual([{ name: 'email', type: 'text' }]);
    });

    it('should log activity:snapshot trace for non-interactive activityType', () => {
      const traceSteps: any[] = [];

      (transport as any).processEvent(
        {
          type: 'ACTIVITY_SNAPSHOT',
          messageId: 'msg-3',
          activityType: 'progress',
          content: { percent: 50 },
        },
        (step: any) => traceSteps.push(step)
      );

      expect(traceSteps).toHaveLength(1);
      expect(traceSteps[0].type).toBe('activity:snapshot');
      expect(traceSteps[0].activityType).toBe('progress');
    });
  });

  describe('processEvent — ACTIVITY_DELTA', () => {
    it('should emit interactive event for activityType: interactive', () => {
      const interactivePayloads: any[] = [];
      bus.on('interactive', (payload: any) => interactivePayloads.push(payload));

      (transport as any).processEvent({
        type: 'ACTIVITY_DELTA',
        messageId: 'msg-1',
        activityType: 'interactive',
        patch: { submitLabel: 'Готово' },
      });

      expect(interactivePayloads).toHaveLength(1);
      expect(interactivePayloads[0].submitLabel).toBe('Готово');
    });

    it('should log activity:delta trace for non-interactive activityType', () => {
      const traceSteps: any[] = [];

      (transport as any).processEvent(
        {
          type: 'ACTIVITY_DELTA',
          messageId: 'msg-1',
          activityType: 'progress',
          patch: [{ op: 'replace', path: '/percent', value: 75 }],
        },
        (step: any) => traceSteps.push(step)
      );

      expect(traceSteps).toHaveLength(1);
      expect(traceSteps[0].type).toBe('activity:delta');
      expect(traceSteps[0].activityType).toBe('progress');
    });
  });

  describe('sendMessage — streaming (инкрементальный SSE)', () => {
    // Mock ReadableStream: отдаёт чанки по очереди, затем done
    const mockStream = (chunks: string[]) => {
      let i = 0;
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              if (i < chunks.length) {
                return { done: false, value: new TextEncoder().encode(chunks[i++]) };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      };
    };

    const aguiData = (obj: Record<string, any>) => `data: ${JSON.stringify(obj)}\n\n`;

    it('emits only assistant-role text as chunks (filters intermediate step messages)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockStream([
          aguiData({ type: 'RUN_STARTED', threadId: '7bb8942d-5110-4eea-82fc-7c943e310fea', runId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }),
          aguiData({ type: 'STEP_STARTED', stepName: 'intent_gatekeeper' }),
          // Промежуточное сообщение НЕ-assistenta — не должно попасть в ответ
          aguiData({ type: 'TEXT_MESSAGE_START', messageId: 'msg-c25a4f1e-88d7-4b03-9f61-2ac07de55b31', role: 'user' }),
          aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-c25a4f1e-88d7-4b03-9f61-2ac07de55b31', delta: 'internal note' }),
          aguiData({ type: 'TEXT_MESSAGE_END', messageId: 'msg-c25a4f1e-88d7-4b03-9f61-2ac07de55b31' }),
          aguiData({ type: 'STEP_FINISHED', stepName: 'intent_gatekeeper' }),
          // Финальное сообщение ассистента
          aguiData({ type: 'TEXT_MESSAGE_START', messageId: 'msg-9e1f77c2-4b58-42ad-8c30-6df21aa90e44', role: 'assistant' }),
          aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-9e1f77c2-4b58-42ad-8c30-6df21aa90e44', delta: 'Hello' }),
          aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-9e1f77c2-4b58-42ad-8c30-6df21aa90e44', delta: ' world' }),
          aguiData({ type: 'TEXT_MESSAGE_END', messageId: 'msg-9e1f77c2-4b58-42ad-8c30-6df21aa90e44' }),
          aguiData({ type: 'RUN_FINISHED', threadId: '7bb8942d-5110-4eea-82fc-7c943e310fea', runId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }),
        ])
      );

      const chunks: string[] = [];
      bus.on('chunk', (c: string) => chunks.push(c));

      const result = await transport.sendMessage('hi');

      expect(result).toBe('Hello world');
      expect(chunks.join('')).toBe('Hello world');
      expect(chunks).not.toContain('internal note');
    });

    it('saves threadId into bus.context after RUN_STARTED/RUN_FINISHED', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockStream([
          aguiData({ type: 'RUN_STARTED', threadId: '3f2a1b9c-7d4e-48a6-b1f0-e5c9d2a83716', runId: 'ff00aa55de1749b38c620f1e4a7d9c23' }),
          aguiData({ type: 'TEXT_MESSAGE_START', messageId: 'msg-11d4a2be-6c38-49f7-90ab-2e57f1c3d804', role: 'assistant' }),
          aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-11d4a2be-6c38-49f7-90ab-2e57f1c3d804', delta: 'ok' }),
          aguiData({ type: 'TEXT_MESSAGE_END', messageId: 'msg-11d4a2be-6c38-49f7-90ab-2e57f1c3d804' }),
          aguiData({ type: 'RUN_FINISHED', threadId: '3f2a1b9c-7d4e-48a6-b1f0-e5c9d2a83716', runId: 'ff00aa55de1749b38c620f1e4a7d9c23' }),
        ])
      );

      const contextUpdates: any[] = [];
      bus.on('contextUpdate', (ctx: any) => contextUpdates.push(ctx));

      await transport.sendMessage('hi');

      expect(bus.context.thread_id).toBe('3f2a1b9c-7d4e-48a6-b1f0-e5c9d2a83716');
      expect(bus.context.lastRunId).toBe('ff00aa55de1749b38c620f1e4a7d9c23');
      expect(contextUpdates.length).toBeGreaterThanOrEqual(1);
      expect(contextUpdates[contextUpdates.length - 1].thread_id).toBe('3f2a1b9c-7d4e-48a6-b1f0-e5c9d2a83716');
    });

    it('includes threadId in request body when known from previous run', async () => {
      bus.context.thread_id = 'd8e6f03a-52b1-47c9-9e4d-1a08bc73fe55';
      (global.fetch as jest.Mock).mockResolvedValue(mockStream([]));

      await transport.sendMessage('next question');

      const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.threadId).toBe('d8e6f03a-52b1-47c9-9e4d-1a08bc73fe55');
      expect(body.runId).toBeTruthy();
    });

    it('handles chunk boundaries splitting SSE events (no lost/duplicated data)', async () => {
      const stream =
        aguiData({ type: 'RUN_STARTED', threadId: 'b41c8e77-9f03-42ad-a6d5-30ce18f94b27', runId: '0c9e2f7ab1844d06ae3591cf20d6b748' }) +
        aguiData({ type: 'TEXT_MESSAGE_START', messageId: 'msg-77a3c1e9-05d8-4b2f-8a61-cc904ef13b52', role: 'assistant' }) +
        aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-77a3c1e9-05d8-4b2f-8a61-cc904ef13b52', delta: 'Парагра' }) +
        aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-77a3c1e9-05d8-4b2f-8a61-cc904ef13b52', delta: 'ф!' }) +
        aguiData({ type: 'TEXT_MESSAGE_END', messageId: 'msg-77a3c1e9-05d8-4b2f-8a61-cc904ef13b52' }) +
        ': keep-alive\n\n' +
        aguiData({ type: 'RUN_FINISHED', threadId: 'b41c8e77-9f03-42ad-a6d5-30ce18f94b27', runId: '0c9e2f7ab1844d06ae3591cf20d6b748' });

      // Режем поток на мелкие куски в произвольных местах — границы событий рвутся
      const smallChunks: string[] = [];
      for (let i = 0; i < stream.length; i += 7) {
        smallChunks.push(stream.slice(i, i + 7));
      }
      (global.fetch as jest.Mock).mockResolvedValue(mockStream(smallChunks));

      const result = await transport.sendMessage('hi');

      expect(result).toBe('Параграф!');
      expect(bus.context.thread_id).toBe('b41c8e77-9f03-42ad-a6d5-30ce18f94b27');
    });

    it('processes the final event without trailing blank line (flush)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockStream([
          aguiData({ type: 'TEXT_MESSAGE_START', messageId: 'msg-5c08e3fa-2b71-4d94-9a60-71fd3ba9c082', role: 'assistant' }),
          aguiData({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-5c08e3fa-2b71-4d94-9a60-71fd3ba9c082', delta: 'tail' }),
          // последнее событие без завершающего \n\n
          'data: {"type":"TEXT_MESSAGE_END","messageId":"msg-5c08e3fa-2b71-4d94-9a60-71fd3ba9c082"}',
        ])
      );

      const result = await transport.sendMessage('hi');
      expect(result).toBe('tail');
    });
  });
});
