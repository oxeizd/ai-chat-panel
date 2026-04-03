import { useState, useCallback, useRef } from 'react';
import { Message, AgentConfig } from 'types';
import { useAgent } from 'components/agent';
import { GrafanaUser } from '../../hooks/useGrafanaUser';
import { MESSAGES } from '../core/config';

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const sessionIdRef = useRef(generateSessionId());
  const isSendingRef = useRef(false);

  const { isLoading, sendMessage: agentSendMessage, resetSession } = useAgent(currentAgent);

  // Основная функция отправки текста, возвращает успех/ошибку
  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      if (isSendingRef.current) {
        return false;
      }
      if (!text.trim() || isLoading) {
        return false;
      }
      if (!currentAgent) {
        const errorMessage: Message = {
          id: generateMessageId(),
          text: MESSAGES.noAgentSelected,
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return false;
      }

      isSendingRef.current = true;

      const userMessageId = generateMessageId();
      const userMessage: Message = {
        id: userMessageId,
        text,
        sender: 'user',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

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

        const reply = await agentSendMessage(text, additionalContext);

        const aiMessage: Message = {
          id: generateMessageId(),
          text: reply,
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        return true;
      } catch (error: any) {
        let statusCode: number | undefined;
        let errorMessage = MESSAGES.errorResponse;
        let rawError = '';

        // Получаем raw тело ошибки, если есть
        if (error?.responseBody) {
          rawError = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody);
        } else if (error?.message) {
          rawError = error.message;
        }

        // Пытаемся извлечь читаемое сообщение
        try {
          const parsed = JSON.parse(rawError);
          errorMessage = parsed.error?.message || parsed.message || parsed.error?.metadata?.raw || 'Неизвестная ошибка';
          statusCode = parsed.error?.code || parsed.status || error.status;
        } catch {
          // Если не JSON, используем rawError как есть (обрезаем)
          if (rawError) {
            errorMessage = rawError.length > 200 ? rawError.substring(0, 200) + '...' : rawError;
          }
        }

        // Если всё ещё нет статуса, пробуем взять из error.status
        if (!statusCode && error?.status) {
          statusCode = error.status;
        }

        // Дополнительные понятные сообщения для частых кодов
        if (statusCode === 429) {
          errorMessage = 'Слишком много запросов (Rate limit). Попробуйте позже.';
        } else if (statusCode === 400) {
          errorMessage = 'Неверный запрос';
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'Ошибка авторизации';
        } else if (statusCode && statusCode >= 500) {
          errorMessage = 'Ошибка на сервере. Повторите позже.';
        }

        // Помечаем сообщение пользователя
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessageId
              ? { ...msg, error: true, errorDetails: { status: statusCode, message: errorMessage, raw: rawError } }
              : msg
          )
        );

        // Сообщение от AI
        const errorAiMessage: Message = {
          id: generateMessageId(),
          text: `❌ ${errorMessage}`,
          sender: 'ai',
          timestamp: Date.now(),
          errorDetails: { status: statusCode, message: errorMessage, raw: rawError },
        };
        setMessages((prev) => [...prev, errorAiMessage]);

        return false;
      } finally {
        isSendingRef.current = false;
      }
    },
    [currentAgent, isLoading, agentSendMessage, user]
  );

  // sendMessage с опциональным текстом
  const sendMessage = useCallback(
    (customText?: string) => {
      const textToSend = customText !== undefined ? customText : inputValue;
      if (textToSend.trim()) {
        sendText(textToSend);
        if (customText === undefined) {
          setInputValue('');
        }
      }
    },
    [inputValue, sendText]
  );

  // Повторная отправка сообщения – не удаляем историю, а отправляем заново и обновляем статус
  const retryMessage = useCallback(
    async (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1 || messages[msgIndex].sender !== 'user') {
        return;
      }

      const originalMessage = messages[msgIndex];
      // Убираем флаг ошибки у пользовательского сообщения
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: false } : m)));

      // Удаляем последующие сообщения (ответы AI, включая ошибочные)
      const newMessages = messages.slice(0, msgIndex + 1);
      setMessages(newMessages);

      // Отправляем заново
      const success = await sendText(originalMessage.text);
      if (!success) {
        // Если повторная отправка не удалась, возвращаем флаг ошибки пользовательскому сообщению
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: true } : m)));
      }
    },
    [messages, sendText]
  );

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
    retryMessage,
  };
};
