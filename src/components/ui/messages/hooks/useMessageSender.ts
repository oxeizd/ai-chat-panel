import { useCallback, useRef, useEffect } from 'react';
import { useAgent } from 'components/agent/useAgent';
import { AgentConfig, TraceStep } from 'types';
import { GrafanaUser } from '../../../hooks/useGrafanaUser';
import { useAgentEvents } from 'components/agent/useAgentEvents';

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
  onFileAttachment?: (file: any) => void;
  onInteractive?: (payload: any) => void;
}

export const useMessageSender = ({ agent: agentConfig, user }: UseMessageSenderOptions) => {
  const {
    isLoading,
    sendMessage: agentSendMessage,
    resetSession,
    abort: abortAgent,
    onChunk,
    onReasoningStart,
    onReasoningChunk,
    onReasoningEnd,
    onContextUpdate,
    onFileAttachment,
    onInteractive,
    getContextValue,
    setContext,
    runOperation,
    markSessionStarted,
  } = useAgent(agentConfig);

  const callbacksRef = useRef<SendCallbacks>({});

  useAgentEvents({
    subscriptions: {
      onChunk,
      onReasoningStart: (handler) => {
        return onReasoningStart((payload) => {
          handler(payload);
          callbacksRef.current.onThinkingStart?.();
        });
      },
      onReasoningChunk,
      onReasoningEnd: (handler) => {
        return onReasoningEnd((text) => {
          handler(text);
          callbacksRef.current.onReasoningComplete?.(text);
          callbacksRef.current.onThinkingEnd?.();
        });
      },
      onFileAttachment,
      onInteractive,
    },
    callbacksRef: callbacksRef as any,
  });

  useEffect(() => {
    if (!onFileAttachment) {
      return;
    }

    const unsubscribe = onFileAttachment((file) => {
      callbacksRef.current.onFileAttachment?.(file);
    });

    return unsubscribe;
  }, [onFileAttachment]);

  const send = useCallback(
    async (text: string, callbacks?: SendCallbacks, extraContext?: Record<string, any>): Promise<string | null> => {
      if (!agentConfig || isLoading) {
        return null;
      }

      callbacksRef.current = callbacks || {};

      const additionalContext: Record<string, any> = {
        ...extraContext,
      };

      if (user) {
        additionalContext.userId = user.id;
        additionalContext.userLogin = user.login;
        additionalContext.userEmail = user.email;
        additionalContext.userName = user.name;
      }

      try {
        return await agentSendMessage(text, additionalContext, callbacks?.onStep);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return null;
        }

        throw error;
      } finally {
        callbacksRef.current = {};
      }
    },
    [agentConfig, isLoading, user, agentSendMessage]
  );

  const abort = useCallback(() => {
    abortAgent();
  }, [abortAgent]);

  const reset = useCallback(async () => {
    await resetSession();
  }, [resetSession]);

  const getThreadId = useCallback(
    () => getContextValue?.(agentConfig?.threadIdContextKey || 'thread_id'),
    [getContextValue, agentConfig?.threadIdContextKey]
  );

  const markStarted = useCallback(() => {
    markSessionStarted();
  }, [markSessionStarted]);

  return {
    send,
    abort,
    reset,
    isSending: isLoading,
    getThreadId,
    setContext,
    onContextUpdate,
    runOperation,
    markStarted,
  };
};
