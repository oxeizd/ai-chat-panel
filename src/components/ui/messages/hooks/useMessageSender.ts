import { useCallback, useRef } from 'react';
import { useAgent } from 'components/agent/hooks/useAgent';
import { AgentConfig, TraceStep } from 'components/agent/shared/types';
import { GrafanaUser } from 'components/hooks/useGrafanaUser';
import { useAgentEvents } from 'components/agent/hooks/useAgentEvents';

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
    getContextValue,
  } = useAgent(agent);

  const callbacksRef = useRef<SendCallbacks>({});

  useAgentEvents({
    agent: {
      onChunk: subscribeChunk,
      onReasoningChunk: subscribeReasoning,
      onReasoningComplete: subscribeReasoningComplete,
      onThinkingStart: subscribeThinkingStart,
      onThinkingEnd: subscribeThinkingEnd,
    },
    events: callbacksRef,
  });

  const send = useCallback(
    async (text: string, callbacks?: SendCallbacks): Promise<string | null> => {
      if (!agent || isLoading) {
        return null;
      }

      callbacksRef.current = callbacks || {};

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
        callbacksRef.current = {};
      }
    },
    [agent, isLoading, user, agentSendMessage]
  );

  const abort = useCallback(() => abortAgent(), [abortAgent]);
  const reset = useCallback(async () => await resetSession(), [resetSession]);

  const getThreadId = useCallback(() => {
    return getContextValue?.(':thread_id');
  }, [getContextValue]);

  return {
    send,
    abort,
    reset,
    isSending: isLoading,
    onChunk: subscribeChunk,
    onReasoningChunk: subscribeReasoning,
    getThreadId,
  };
};
