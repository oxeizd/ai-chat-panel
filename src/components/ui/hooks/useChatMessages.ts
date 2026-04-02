import { useState, useCallback, useRef } from 'react';
import { Message, AgentConfig } from 'types';
import { useAgent } from 'components/agent';
import { GrafanaUser } from './useGrafanaUser';
import { MESSAGES } from '../config';

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const generateMessageId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const sessionIdRef = useRef(generateSessionId());
  const isSendingRef = useRef(false);

  const { isLoading, sendMessage: agentSendMessage, resetSession } = useAgent(currentAgent);

  const newChat = useCallback(async () => {
    setMessages([]);
    setInputValue('');
    sessionIdRef.current = generateSessionId();
    try {
      await resetSession();
    } catch (err) {
      console.warn('Failed to reset session on backend', err);
    }
  }, [resetSession]);

  const sendMessage = useCallback(async () => {
    // Защита от повторного вызова
    if (isSendingRef.current) {
      return;
    }

    if (!inputValue.trim() || isLoading || !currentAgent) {
      return;
    }

    isSendingRef.current = true;

    const userMessage: Message = {
      id: generateMessageId(),
      text: inputValue,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');

    try {
      const additionalContext: Record<string, any> = {
        sessionID: sessionIdRef.current,
      };
      if (user) {
        additionalContext.userId = user.id;
        additionalContext.userLogin = user.login;
        additionalContext.userEmail = user.email;
        additionalContext.userName = user.name;
      }

      const reply = await agentSendMessage(currentInput, additionalContext);

      const aiMessage: Message = {
        id: generateMessageId(),
        text: reply,
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId(),
          text: MESSAGES.errorResponse,
          sender: 'ai',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      isSendingRef.current = false;
    }
  }, [inputValue, isLoading, currentAgent, user, agentSendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
  };
};
