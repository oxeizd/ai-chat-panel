import { useState, useEffect, useCallback } from 'react';
import { AgentConfig, TraceStep } from 'types';
import { Agent } from './core/agent';

export const useAgent = (config: AgentConfig | null) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      try {
        const newAgent = new Agent(config);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAgent(newAgent);
        setAgentError(null);
      } catch (err) {
        console.error('Failed to initialize agent from config:', err, config);
        setAgent(null);
        setAgentError(err instanceof Error ? err.message : String(err));
      }
    } else {
      setAgent(null);
      setAgentError(null);
    }
    return () => {
      setAgent(null);
    };
  }, [config]);

  const sendMessage = useCallback(
    async (userInput: string, additionalContext?: Record<string, any>, onTrace?: (step: TraceStep) => void) => {
      if (!agent) {
        throw new Error(agentError || 'Agent not initialized');
      }
      setIsLoading(true);
      try {
        return await agent.sendMessage(userInput, additionalContext, onTrace);
      } finally {
        setIsLoading(false);
      }
    },
    [agent, agentError]
  );

  const runOperation = useCallback(
    async (operation: string, additionalContext?: Record<string, any>) => {
      if (!agent) {
        throw new Error(agentError || 'Agent not initialized');
      }
      return agent.runOperation(operation, additionalContext);
    },
    [agent, agentError]
  );

  const resetSession = useCallback(() => agent?.resetSession(), [agent]);
  const abort = useCallback(() => agent?.abort(), [agent]);

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

  const onFileAttachment = useCallback(
    (handler: (file: any) => void) => {
      return agent?.on('fileAttachment', handler) ?? (() => {});
    },
    [agent]
  );

  const onInteractive = useCallback(
    (handler: (payload: any) => void) => {
      return agent?.on('interactive', handler) ?? (() => {});
    },
    [agent]
  );

  const getContextValue = useCallback((key: string) => agent?.getContextValue(key), [agent]);
  const getContext = useCallback(() => agent?.getContext(), [agent]);

  const setContext = useCallback(
    (partial: Record<string, any>) => {
      agent?.setContext(partial);
    },
    [agent]
  );

  return {
    agent,
    isLoading,
    agentError,
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
    setContext,
    onFileAttachment,
    onInteractive,
    runOperation,
  };
};
