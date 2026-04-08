// useAgent.ts
import { useRef, useState, useEffect, useCallback } from 'react';
import { AgentConfig, TraceStep } from 'types';
import { AgentClient } from './AgentClient';

export const useAgent = (agentConfig: AgentConfig | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef<AgentClient | null>(null);

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
      setIsLoading(true);
      try {
        return await clientRef.current.sendMessage(userInput, additionalContext, onTrace, onChunk);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetSession = useCallback(async () => {
    await clientRef.current?.resetSession();
  }, []);

  return { isLoading, sendMessage, resetSession };
};
