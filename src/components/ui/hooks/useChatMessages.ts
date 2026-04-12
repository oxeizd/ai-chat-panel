import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, AgentConfig, DebugTrace, TraceStep } from 'types';
import { useAgent } from 'components/agent/useAgent';
import { GrafanaUser } from '../../hooks/useGrafanaUser';
import { MESSAGES } from '../core/config';

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null, debug: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const sessionIdRef = useRef(generateSessionId());
  const isSendingRef = useRef(false);
  const [traces, setTraces] = useState<Map<string, DebugTrace>>(new Map());

  const { isLoading, sendMessage: agentSendMessage, resetSession, abort } = useAgent(currentAgent);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

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

      // Создаём пустое сообщение ассистента для накопления чанков
      const assistantMessageId = generateMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: '',
          sender: 'ai',
          timestamp: Date.now(),
        },
      ]);

      let trace: DebugTrace | undefined;
      if (debug) {
        trace = {
          userMessageId,
          userInput: text,
          steps: [],
        };
        setTraces((prev) => new Map(prev).set(userMessageId, trace!));
      }

      const addTraceStep = (step: TraceStep) => {
        if (!debug || !trace) {
          return;
        }
        trace.steps.push(step);
        setTraces((prev) => new Map(prev).set(userMessageId, trace));
      };

      // Обработчик чанков (стриминг)
      const handleChunk = (chunk: string) => {
        if (!chunk) {
          return;
        }
        setMessages((prev) => {
          const newMessages = [...prev];
          const assistantIndex = newMessages.findIndex((m) => m.id === assistantMessageId);
          if (assistantIndex !== -1) {
            newMessages[assistantIndex] = {
              ...newMessages[assistantIndex],
              text: newMessages[assistantIndex].text + chunk,
            };
          }
          return newMessages;
        });
      };

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

        // Передаём handleChunk как четвёртый аргумент (onChunk)
        const reply = await agentSendMessage(text, additionalContext, addTraceStep, handleChunk);

        if (debug && trace) {
          trace.finalReply = reply;
          setTraces((prev) => new Map(prev).set(userMessageId, trace));
        }

        // Финальная синхронизация (на случай, если последний чанк не пришёл или reply полнее)
        setMessages((prev) => {
          const newMessages = [...prev];
          const assistantIndex = newMessages.findIndex((m) => m.id === assistantMessageId);
          if (assistantIndex !== -1) {
            const currentText = newMessages[assistantIndex].text;
            if (reply !== currentText) {
              newMessages[assistantIndex] = {
                ...newMessages[assistantIndex],
                text: reply,
              };
            }
          }
          return newMessages;
        });

        return true;
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'Request was cancelled') {
          // Удаляем пустое сообщение ассистента
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
          isSendingRef.current = false;
          return false;
        }

        // Удаляем пустое сообщение ассистента, если оно есть
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));

        let statusCode: number | undefined;
        let errorMessage = MESSAGES.errorResponse;
        let rawError = '';

        if (error?.responseBody) {
          rawError = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody);
        } else if (error?.message) {
          rawError = error.message;
        }

        try {
          const parsed = JSON.parse(rawError);
          errorMessage = parsed.error?.message || parsed.message || parsed.error?.metadata?.raw || 'Неизвестная ошибка';
          statusCode = parsed.error?.code || parsed.status || error.status;
        } catch {
          if (rawError) {
            errorMessage = rawError.length > 200 ? rawError.substring(0, 200) + '...' : rawError;
          }
        }

        if (!statusCode && error?.status) {
          statusCode = error.status;
        }

        if (statusCode === 429) {
          errorMessage = 'Слишком много запросов (Rate limit). Попробуйте позже.';
        } else if (statusCode === 400) {
          errorMessage = 'Неверный запрос';
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'Ошибка авторизации';
        } else if (statusCode && statusCode >= 500) {
          errorMessage = 'Ошибка на сервере. Повторите позже.';
        }

        if (debug && trace) {
          trace.error = { message: errorMessage, status: statusCode, raw: rawError };
          setTraces((prev) => new Map(prev).set(userMessageId, trace));
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessageId
              ? { ...msg, error: true, errorDetails: { status: statusCode, message: errorMessage, raw: rawError } }
              : msg
          )
        );

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
    [currentAgent, isLoading, agentSendMessage, user, debug]
  );

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

  const retryMessage = useCallback(
    async (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1 || messages[msgIndex].sender !== 'user') {
        return;
      }

      const originalMessage = messages[msgIndex];
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: false } : m)));

      const newMessages = messages.slice(0, msgIndex + 1);
      setMessages(newMessages);

      const success = await sendText(originalMessage.text);
      if (!success) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: true } : m)));
      }
    },
    [messages, sendText]
  );

  const newChat = useCallback(async () => {
    setMessages([]);
    setInputValue('');
    sessionIdRef.current = generateSessionId();
    setTraces(new Map());
    try {
      await resetSession();
    } catch (err) {
      console.warn('Failed to reset session on backend', err);
    }
  }, [resetSession]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setTraces(new Map());
  }, []);

  const getTrace = useCallback((messageId: string) => traces.get(messageId), [traces]);

  return {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
    retryMessage,
    traces,
    getTrace,
  };
};
