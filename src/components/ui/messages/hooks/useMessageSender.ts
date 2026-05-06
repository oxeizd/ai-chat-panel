import { useCallback, useRef } from 'react';
import { useAgent } from 'components/agent/useAgent';
import { AgentConfig, TraceStep } from 'types';
import { GrafanaUser } from '../../../hooks/useGrafanaUser';

interface UseMessageSenderOptions {
  agent: AgentConfig | null;
  user: GrafanaUser | null;
}

export const useMessageSender = ({ agent, user }: UseMessageSenderOptions) => {
  const { isLoading, sendMessage: agentSendMessage, resetSession, abort: abortAgent } = useAgent(agent);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  const send = useCallback(
    async (
      text: string,
      onChunk: (chunk: string) => void,
      onStep: (step: TraceStep) => void
    ): Promise<string | null> => {
      if (!agent || isSendingRef.current || isLoading) {
        return null;
      }

      isSendingRef.current = true;
      abortControllerRef.current = new AbortController();

      const additionalContext: Record<string, any> = {};
      if (user) {
        additionalContext.userId = user.id;
        additionalContext.userLogin = user.login;
        additionalContext.userEmail = user.email;
        additionalContext.userName = user.name;
      }

      try {
        const reply = await agentSendMessage(text, additionalContext, onStep, onChunk);
        return reply;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        throw err;
      } finally {
        isSendingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [agent, isLoading, user, agentSendMessage]
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortAgent();
  }, [abortAgent]);

  const reset = useCallback(async () => {
    await resetSession();
  }, [resetSession]);

  return { send, abort, reset, isSending: isSendingRef.current || isLoading };
};
