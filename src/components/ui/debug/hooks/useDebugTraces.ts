import { useState, useCallback } from 'react';
import { DebugTrace, TraceStep } from 'types';
import { ParsedError } from './utils/errorParser';

export const useDebugTraces = (enabled: boolean) => {
  const [traces, setTraces] = useState<Map<string, DebugTrace>>(new Map());

  const create = useCallback(
    (userMessageId: string, userInput: string): DebugTrace | undefined => {
      if (!enabled) {
        return undefined;
      }
      const trace: DebugTrace = { userMessageId, userInput, steps: [] };
      setTraces((prev) => new Map(prev).set(userMessageId, trace));
      return trace;
    },
    [enabled]
  );

  const addStep = useCallback(
    (userMessageId: string, step: TraceStep) => {
      if (!enabled) {
        return;
      }
      setTraces((prev) => {
        const trace = prev.get(userMessageId);
        if (!trace) {
          return prev;
        }
        trace.steps.push(step);
        return new Map(prev);
      });
    },
    [enabled]
  );

  const setReply = useCallback(
    (userMessageId: string, reply: string) => {
      if (!enabled) {
        return;
      }
      setTraces((prev) => {
        const trace = prev.get(userMessageId);
        if (!trace) {
          return prev;
        }
        trace.finalReply = reply;
        return new Map(prev);
      });
    },
    [enabled]
  );

  const setError = useCallback(
    (userMessageId: string, error: ParsedError) => {
      if (!enabled) {
        return;
      }
      setTraces((prev) => {
        const trace = prev.get(userMessageId);
        if (!trace) {
          return prev;
        }
        trace.error = error;
        return new Map(prev);
      });
    },
    [enabled]
  );

  const remove = useCallback((userMessageId: string) => {
    setTraces((prev) => {
      const next = new Map(prev);
      next.delete(userMessageId);
      return next;
    });
  }, []);

  return { traces, create, addStep, setReply, setError, remove };
};
