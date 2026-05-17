import { useState, useEffect, useCallback } from 'react';
import { AgentConfig, TraceStep } from 'types';
import { Agent } from './core/agent';

export const useAgent = (config: AgentConfig | null) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (config) {
      const newAgent = new Agent(config);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAgent(newAgent);
    } else {
      setAgent(null);
    }
    return () => {
      setAgent(null);
    };
  }, [config]);

  const sendMessage = useCallback(
    async (userInput: string, additionalContext?: Record<string, any>, onTrace?: (step: TraceStep) => void) => {
      if (!agent) {
        throw new Error('Agent not initialized');
      }
      setIsLoading(true);
      try {
        return await agent.sendMessage(userInput, additionalContext, onTrace);
      } finally {
        setIsLoading(false);
      }
    },
    [agent]
  );

  const resetSession = useCallback(() => agent?.resetSession(), [agent]);
  const abort = useCallback(() => agent?.abort(), [agent]);

  // Удобные методы подписки (они зависят от agent, поэтому при смене агента создаются новые)
  const onChunk = useCallback(
    (handler: (chunk: string) => void) => {
      return agent?.onChunk(handler) ?? (() => {});
    },
    [agent]
  );

  const onReasoningStart = useCallback(
    (handler: (payload?: { title?: string }) => void) => {
      return agent?.on('reasoning:start', handler) ?? (() => {});
    },
    [agent]
  );

  const onReasoningChunk = useCallback(
    (handler: (chunk: string) => void) => {
      return agent?.on('reasoning:chunk', handler) ?? (() => {});
    },
    [agent]
  );

  const onReasoningEnd = useCallback(
    (handler: (fullText: string) => void) => {
      return agent?.on('reasoning:end', handler) ?? (() => {});
    },
    [agent]
  );

  const onContextUpdate = useCallback(
    (handler: (ctx: Record<string, any>) => void) => {
      return agent?.on('contextUpdate', handler) ?? (() => {});
    },
    [agent]
  );

  const getContextValue = useCallback((key: string) => agent?.getContextValue(key), [agent]);
  const getContext = useCallback(() => agent?.getContext(), [agent]);

  return {
    agent,
    isLoading,
    sendMessage,
    resetSession,
    abort,
    onChunk,
    onReasoningStart,
    onReasoningChunk,
    onReasoningEnd,
    onContextUpdate,
    getContextValue,
    getContext,
  };
};
