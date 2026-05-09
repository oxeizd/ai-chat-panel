import { useRef, useState, useEffect, useCallback } from 'react';
import { AgentClient } from './core/client';
import { AgentConfig, TraceStep } from 'types';

export const useAgent = (agentConfig: AgentConfig | null) => {
  const [isLoading, setIsLoading] = useState(false);

  const clientRef = useRef<AgentClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    clientRef.current = agentConfig ? new AgentClient(agentConfig) : null;
  }, [agentConfig]);

  const sendMessage = useCallback(
    async (userInput: string, additionalCtx?: Record<string, any>, onTrace?: (step: TraceStep) => void) => {
      if (!clientRef.current) {
        throw new Error('Агент не выбран');
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);

      try {
        return await clientRef.current.sendMessage(userInput, additionalCtx, onTrace, abortRef.current.signal);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    []
  );

  const abort = useCallback(() => abortRef.current?.abort(), []);

  const resetSession = useCallback(() => clientRef.current?.resetSession(), []);

  const onChunk = useCallback((fn: (chunk: string) => void) => clientRef.current?.onChunk(fn) ?? (() => {}), []);

  const onReasoningChunk = useCallback(
    (fn: (chunk: string) => void) => clientRef.current?.onReasoningChunk(fn) ?? (() => {}),
    []
  );

  const onReasoningComplete = useCallback(
    (fn: (text: string) => void) => clientRef.current?.onReasoningComplete(fn) ?? (() => {}),
    []
  );

  const getContextValue = useCallback(
    (key: string) => clientRef.current?.getContextValue(key),
    []
  );

  return {
    isLoading,
    sendMessage,
    resetSession,
    abort,
    onChunk,
    onReasoningChunk,
    onReasoningComplete,
    getContextValue
  };
};
