import { useState } from 'react';
import { Message } from '../ChatPanel.types';
import { AgentConfig } from 'types';

export const useChatMessages = (currentAgent: AgentConfig | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !currentAgent) {
      return;
    }

    const userMessage: Message = {
      text: inputValue,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      let requestBody: any = { message: userMessage.text };
      if (currentAgent.config && currentAgent.config.trim()) {
        try {
          const config = JSON.parse(currentAgent.config);
          requestBody = { ...requestBody, ...config };
        } catch (e) {
          console.warn('Invalid agent config JSON, ignoring');
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
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setMessages(prev => [
        ...prev,
        { text: '❌ Не удалось получить ответ. Проверьте соединение.', sender: 'ai', timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => setMessages([]);
  const newChat = () => {
    setMessages([]);
    setInputValue('');
  };

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
