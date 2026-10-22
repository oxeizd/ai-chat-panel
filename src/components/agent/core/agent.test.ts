import { Agent } from './agent';
import type { AgentConfig } from 'types';

// Manual mocks using jest.requireActual to preserve module structure
const mockListThreads = jest.fn();
const mockLoadThread = jest.fn();
const mockAGUIsendMessage = jest.fn();
const mockAGUIAbort = jest.fn();

// Mock AGUITransport before importing Agent
jest.mock('../transport/aguiTransport', () => ({
  AGUITransport: jest.fn().mockImplementation((_config: AgentConfig, _bus: any) => ({
    sendMessage: mockAGUIsendMessage,
    listThreads: mockListThreads,
    loadThread: mockLoadThread,
    abort: mockAGUIAbort,
  })),
}));

const mockSendOperation = jest.fn();
jest.mock('../transport/sender', () => ({
  sendOperation: (...args: any[]) => mockSendOperation(...args),
}));

describe('Agent.runOperation with AGUI', () => {
  let agent: Agent;
  let mockConfig: AgentConfig;

  const createAGUIConfig = (): AgentConfig => ({
    name: 'test-agent',
    url: 'http://localhost:8080/chat',
    default: false,
    endpoints: [
      {
        operation: 'chat',
        method: 'POST',
        path: '/',
        streaming: { enabled: true, parseStrategy: 'agui' },
      },
    ],
    workflow: [],
    startupOperation: '',
    history: true,
    historyListOperation: 'list_threads',
    historyLoadOperation: 'load_thread',
    historyDeleteOperation: 'delete_thread',
    threadIdParam: 'chatId',
    threadIdContextKey: 'thread_id',
  });

  const createNonAGUIConfig = (): AgentConfig => ({
    ...createAGUIConfig(),
    endpoints: [
      {
        operation: 'chat',
        method: 'POST',
        path: '/',
        streaming: { enabled: true, parseStrategy: 'sse' },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createAGUIConfig();
    agent = new Agent(mockConfig);
  });

  describe('AGUI mode enabled (parseStrategy: agui)', () => {
    it('should delegate historyListOperation to AGUITransport.listThreads', async () => {
      const threadsResponse = {
        items: [
          { thread_id: '1', title: 'Thread 1', last_run_at: '2026-10-21T10:00:00Z' },
          { thread_id: '2', title: 'Thread 2', last_run_at: '2026-10-21T11:00:00Z' },
        ],
        total: 2,
      };
      mockListThreads.mockResolvedValue(threadsResponse);

      const result = await agent.runOperation('list_threads');

      expect(mockListThreads).toHaveBeenCalledTimes(1);
      expect(result).toEqual(threadsResponse);
    });

    it('should delegate historyLoadOperation to AGUITransport.loadThread with threadId from context', async () => {
      const threadResponse = {
        thread_id: 'abc-123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };
      mockLoadThread.mockResolvedValue(threadResponse);

      const result = await agent.runOperation('load_thread', { chatId: 'abc-123' });

      expect(mockLoadThread).toHaveBeenCalledWith('abc-123');
      expect(result).toEqual(threadResponse);
    });

    it('should throw error when threadId is missing for load operation', async () => {
      await expect(agent.runOperation('load_thread', {})).rejects.toThrow(
        'threadId is required for history load operation'
      );
    });

    it('should use threadIdContextKey when threadIdParam is not set', async () => {
      mockConfig.threadIdParam = undefined;
      agent = new Agent(mockConfig);

      const threadResponse = { thread_id: 'ctx-456', messages: [] };
      mockLoadThread.mockResolvedValue(threadResponse);

      await agent.runOperation('load_thread', { thread_id: 'ctx-456' });

      expect(mockLoadThread).toHaveBeenCalledWith('ctx-456');
    });

    it('should fall back to sendOperation for delete when AGUI has no built-in delete', async () => {
      const deleteResponse = { ok: true };
      mockSendOperation.mockResolvedValue({ ok: true, data: deleteResponse });

      const result = await agent.runOperation('delete_thread', { chatId: 'abc-123' });

      expect(mockSendOperation).toHaveBeenCalled();
      expect(result).toEqual(deleteResponse);
    });

    it('should delegate non-history operations to sendOperation', async () => {
      const suggestionResponse = ['suggestion1', 'suggestion2'];
      mockSendOperation.mockResolvedValue({ ok: true, data: suggestionResponse });

      const result = await agent.runOperation('get_suggestions');

      expect(mockSendOperation).toHaveBeenCalled();
      expect(result).toEqual(suggestionResponse);
    });
  });

  describe('AGUI mode disabled (parseStrategy: sse/jsonl)', () => {
    beforeEach(() => {
      mockConfig = createNonAGUIConfig();
      agent = new Agent(mockConfig);
    });

    it('should use sendOperation for all operations when AGUI is disabled', async () => {
      const threadsResponse = { items: [], total: 0 };
      mockSendOperation.mockResolvedValue({ ok: true, data: threadsResponse });

      const result = await agent.runOperation('list_threads');

      expect(mockSendOperation).toHaveBeenCalled();
      expect(result).toEqual(threadsResponse);
    });

    it('should use sendOperation for load when AGUI is disabled', async () => {
      const messagesResponse = [{ role: 'user', content: 'Hello' }];
      mockSendOperation.mockResolvedValue({ ok: true, data: messagesResponse });

      const result = await agent.runOperation('load_thread', { chatId: 'abc-123' });

      expect(mockSendOperation).toHaveBeenCalled();
      expect(result).toEqual(messagesResponse);
    });

    it('should NOT delegate to AGUITransport when parseStrategy is sse', async () => {
      const threadsResponse = { items: [], total: 0 };
      mockSendOperation.mockResolvedValue({ ok: true, data: threadsResponse });

      await agent.runOperation('list_threads');

      expect(mockListThreads).not.toHaveBeenCalled();
      expect(mockSendOperation).toHaveBeenCalled();
    });

    it('should NOT delegate to AGUITransport when parseStrategy is jsonl', async () => {
      mockConfig = {
        ...createAGUIConfig(),
        endpoints: [
          {
            operation: 'chat',
            method: 'POST',
            path: '/',
            streaming: { enabled: true, parseStrategy: 'jsonl' },
          },
        ],
      };
      agent = new Agent(mockConfig);

      const threadsResponse = { items: [], total: 0 };
      mockSendOperation.mockResolvedValue({ ok: true, data: threadsResponse });

      await agent.runOperation('list_threads');

      expect(mockListThreads).not.toHaveBeenCalled();
      expect(mockSendOperation).toHaveBeenCalled();
    });
  });

  describe('busy state', () => {
    it('should throw error when agent is processing', async () => {
      mockAGUIsendMessage.mockImplementation(() => new Promise(() => {})); // never resolves

      agent.sendMessage('test');

      // Give sendMessage time to start processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Agent is now processing — use a non-history operation that will throw
      await expect(agent.runOperation('get_suggestions')).rejects.toThrow('Agent is busy');

      // Clean up
      agent.abort();
      // Don't wait for sendPromise - it never resolves by design
    }, 5000);
  });
});
