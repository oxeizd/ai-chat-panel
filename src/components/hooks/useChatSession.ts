import { useState, useCallback } from 'react';

const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const useChatSession = () => {
  const [sessionId, setSessionId] = useState<string>(generateSessionId());

  const resetSession = useCallback(() => {
    setSessionId(generateSessionId());
  }, []);

  return { sessionId, resetSession };
};
