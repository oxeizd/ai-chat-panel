import { useState, useCallback, useRef } from 'react';
import { Message, AgentConfig } from 'types';
import { useAgent } from '../agents';
import { GrafanaUser } from './useGrafanaUser';

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

  const { isLoading, sendMessage: agentSendMessage, resetSession: agentResetSession } = useAgent(currentAgent);

  const newChat = useCallback(async () => {
    setMessages([]);
    setInputValue('');
    sessionIdRef.current = generateSessionId();
    await agentResetSession();
  }, [agentResetSession]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !currentAgent) {
      return;
    }

    const userMessage: Message = {
      id: generateMessageId(),
      text: inputValue,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
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

      const reply = await agentSendMessage(userMessage.text, additionalContext);

      const aiMessage: Message = {
        id: generateMessageId(),
        text: reply,
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setMessages((prev) => [
        ...prev,
        { id: generateMessageId(), text: '❌ Не удалось получить ответ. Проверьте соединение.', sender: 'ai', timestamp: Date.now() },
      ]);
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