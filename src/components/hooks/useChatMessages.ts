import { useState, useCallback, useRef } from 'react';
import { Message } from '../ChatPanel.types';
import { AgentConfig } from 'types';
import { GrafanaUser } from './useGrafanaUser';

// Генерация уникального идентификатора
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const sessionIdRef = useRef(generateSessionId());

  const newChat = useCallback(() => {
    setMessages([]);
    setInputValue('');
    sessionIdRef.current = generateSessionId(); // новый чат = новая сессия
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !currentAgent) {
      return;
    }

    const userMessage: Message = {
      text: inputValue,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      let requestBody: any = { message: userMessage.text };

      if (currentAgent.config && currentAgent.config.trim()) {
        try {
          let configStr = currentAgent.config;
          if (user) {
            configStr = configStr.replace(/\${userId}/g, user.id.toString());
            configStr = configStr.replace(/\${userLogin}/g, user.login);
            configStr = configStr.replace(/\${userEmail}/g, user.email);
            configStr = configStr.replace(/\${userName}/g, user.name);
          }
          configStr = configStr.replace(/\${sessionID}/g, sessionIdRef.current);
          const config = JSON.parse(configStr);
          requestBody = { ...requestBody, ...config };
        } catch (e) {
          console.warn('Invalid agent config JSON, ignoring', e);
        }
      }

      const response = await fetch(currentAgent.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const aiMessage: Message = {
        text: data.reply || 'Ответ не получен',
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setMessages((prev) => [
        ...prev,
        { text: '❌ Не удалось получить ответ. Проверьте соединение.', sender: 'ai', timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentAgent, user]);

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
