import { useRef, useState, useEffect, useCallback } from 'react';
import { AgentConfig, TraceStep } from 'types';
import { AgentClient } from './agentClient';

export const useAgent = (agentConfig: AgentConfig | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef<AgentClient | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    clientRef.current = agentConfig ? new AgentClient(agentConfig) : null;
  }, [agentConfig]);

  const sendMessage = useCallback(
    async (
      userInput: string,
      additionalContext?: Record<string, any>,
      onTrace?: (step: TraceStep) => void,
      onChunk?: (chunk: string) => void
    ) => {
      if (!clientRef.current) {
        throw new Error('Агент не выбран');
      }

      // Отменяем предыдущий запрос, если он ещё активен
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      try {
        return await clientRef.current.sendMessage(
          userInput,
          additionalContext,
          onTrace,
          onChunk,
          abortControllerRef.current.signal
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const resetSession = useCallback(async () => {
    await clientRef.current?.resetSession();
  }, []);

  return { isLoading, sendMessage, resetSession, abort };
};
