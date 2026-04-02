import { useRef, useState, useEffect, useCallback } from 'react';
import { AgentConfig } from 'types';
import { AgentClient } from './AgentClient';

export const useAgent = (agentConfig: AgentConfig | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef<AgentClient | null>(null);

  useEffect(() => {
    if (agentConfig) {
      clientRef.current = new AgentClient(agentConfig);
    } else {
      clientRef.current = null;
    }
  }, [agentConfig]);

  const sendMessage = useCallback(
    async (userInput: string, additionalContext?: Record<string, any>) => {
      if (!clientRef.current) {
        throw new Error('Агент не выбран');
      }
      setIsLoading(true);
      try {
        const reply = await clientRef.current.sendMessage(userInput, additionalContext);
        return reply;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetSession = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.resetSession();
    }
  }, []);

  return {
    isLoading,
    sendMessage,
    resetSession,
  };
};
