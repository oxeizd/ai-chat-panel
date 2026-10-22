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
});
