import { useCallback } from 'react';
import { useAgent } from 'components/agent/useAgent';
import { AgentConfig, TraceStep } from 'components/agent/shared/types';
import { GrafanaUser } from '../../../hooks/useGrafanaUser';

interface UseMessageSenderOptions {
  agent: AgentConfig | null;
  user: GrafanaUser | null;
}

interface SendCallbacks {
  onChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onReasoningComplete?: (text: string) => void;
  onThinkingStart?: () => void;
  onThinkingEnd?: () => void;
  onStep?: (step: TraceStep) => void;
}

export const useMessageSender = ({ agent, user }: UseMessageSenderOptions) => {
  const {
    isLoading,
    sendMessage: agentSendMessage,
    resetSession,
    abort: abortAgent,
    onChunk: subscribeChunk,
    onReasoningChunk: subscribeReasoning,
    onReasoningComplete: subscribeReasoningComplete,
    onThinkingStart: subscribeThinkingStart,
    onThinkingEnd: subscribeThinkingEnd,
  } = useAgent(agent);

  const send = useCallback(
    async (text: string, callbacks?: SendCallbacks): Promise<string | null> => {
      if (!agent || isLoading) {
        return null;
      }

      // Подписки на чанки и reasoning через шину
      const unsubs: Array<() => void> = [];
      if (callbacks?.onChunk) {
        unsubs.push(subscribeChunk(callbacks.onChunk));
      }
      if (callbacks?.onReasoningChunk) {
        unsubs.push(subscribeReasoning(callbacks.onReasoningChunk));
      }
      if (callbacks?.onReasoningComplete) {
        unsubs.push(subscribeReasoningComplete(callbacks.onReasoningComplete));
      }
      if (callbacks?.onThinkingStart) {
        unsubs.push(subscribeThinkingStart(callbacks.onThinkingStart));
      }
      if (callbacks?.onThinkingEnd) {
        unsubs.push(subscribeThinkingEnd(callbacks.onThinkingEnd));
      }

      const additionalContext: Record<string, any> = {};
      if (user) {
        additionalContext.userId = user.id;
        additionalContext.userLogin = user.login;
        additionalContext.userEmail = user.email;
        additionalContext.userName = user.name;
      }

      try {
        const reply = await agentSendMessage(text, additionalContext, callbacks?.onStep);
        return reply;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        throw err;
      } finally {
        unsubs.forEach((unsub) => unsub());
      }
    },
    [
      agent,
      isLoading,
      user,
      agentSendMessage,
      subscribeChunk,
      subscribeReasoning,
      subscribeReasoningComplete,
      subscribeThinkingStart,
      subscribeThinkingEnd,
    ]
  );

  const abort = useCallback(() => {
    abortAgent();
  }, [abortAgent]);

  const reset = useCallback(async () => {
    await resetSession();
  }, [resetSession]);

  return {
    send,
    abort,
    reset,
    isSending: isLoading,
    onChunk: subscribeChunk,
    onReasoningChunk: subscribeReasoning,
  };
};
