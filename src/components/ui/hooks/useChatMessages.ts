import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, AgentConfig, DebugTrace, TraceStep } from 'types';
import { useAgent } from 'components/agent/useAgent';
import { GrafanaUser } from '../../hooks/useGrafanaUser';
import { MESSAGES } from '../chat/config';

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
  const [traces, setTraces] = useState<Map<string, DebugTrace>>(new Map());

  const sessionIdRef = useRef(generateSessionId());
  const isSendingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { isLoading, sendMessage: agentSendMessage, resetSession, abort } = useAgent(currentAgent);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abort();
    };
  }, [abort]);

  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      if (!mountedRef.current) {
        return false;
      }

      if (isSendingRef.current) {
        return false;
      }

      if (!text.trim() || isLoading) {
        return false;
      }

      if (!currentAgent) {
        if (!mountedRef.current) {
          return false;
        }
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

      if (mountedRef.current) {
        setMessages((prev) => [...prev, userMessage]);
      } else {
        isSendingRef.current = false;
        return false;
      }

      const assistantMessageId = generateMessageId();
      if (mountedRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            text: '',
            sender: 'ai',
            timestamp: Date.now(),
          },
        ]);
      } else {
        isSendingRef.current = false;
        return false;
      }

      let trace: DebugTrace | undefined;
      if (debug) {
        trace = {
          userMessageId,
          userInput: text,
          steps: [],
        };
        if (mountedRef.current) {
          setTraces((prev) => new Map(prev).set(userMessageId, trace!));
        }
      }

      const addTraceStep = (step: TraceStep) => {
        if (!debug || !trace || !mountedRef.current) {
          return;
        }
        trace.steps.push(step);
        setTraces((prev) => new Map(prev).set(userMessageId, trace));
      };

      const handleChunk = (chunk: string) => {
        if (!chunk || !mountedRef.current) {
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

        abortControllerRef.current = new AbortController();

        const reply = await agentSendMessage(text, additionalContext, addTraceStep, handleChunk);

        if (abortControllerRef.current?.signal.aborted || !mountedRef.current) {
          return false;
        }

        if (debug && trace && mountedRef.current) {
          trace.finalReply = reply;
          setTraces((prev) => new Map(prev).set(userMessageId, trace));
        }

        if (mountedRef.current) {
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
        }

        return true;
      } catch (error: any) {
        if (!mountedRef.current) {
          return false;
        }

        if (error.name === 'AbortError' || error.message === 'Request was cancelled') {
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

        if (debug && trace && mountedRef.current) {
          trace.error = { message: errorMessage, status: statusCode, raw: rawError };
          setTraces((prev) => new Map(prev).set(userMessageId, trace));
        }

        if (mountedRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId
                ? { ...msg, error: true, errorDetails: { status: statusCode, message: errorMessage, raw: rawError } }
                : msg
            )
          );
        }

        const errorAiMessage: Message = {
          id: generateMessageId(),
          text: `❌ ${errorMessage}`,
          sender: 'ai',
          timestamp: Date.now(),
          errorDetails: { status: statusCode, message: errorMessage, raw: rawError },
        };

        if (mountedRef.current) {
          setMessages((prev) => [...prev, errorAiMessage]);
        }

        return false;
      } finally {
        isSendingRef.current = false;
        abortControllerRef.current = null;
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
      if (!mountedRef.current) {
        return;
      }

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1 || messages[msgIndex].sender !== 'user') {
        return;
      }

      const originalMessage = messages[msgIndex];

      setTraces((prev) => {
        const newTraces = new Map(prev);
        newTraces.delete(messageId);
        return newTraces;
      });

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: false } : m)));

      const newMessages = messages.slice(0, msgIndex + 1);
      setMessages(newMessages);

      const success = await sendText(originalMessage.text);
      if (!success && mountedRef.current) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, error: true } : m)));
      }
    },
    [messages, sendText]
  );

  const newChat = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (mountedRef.current) {
      setMessages([]);
      setInputValue('');
      setTraces(new Map());
    }

    sessionIdRef.current = generateSessionId();

    try {
      await resetSession();
    } catch (err) {
      console.warn('Failed to reset session on backend', err);
    }
  }, [resetSession]);

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (mountedRef.current) {
      setMessages([]);
      setTraces(new Map());
    }
  }, []);

  const getTrace = useCallback((messageId: string) => traces.get(messageId), [traces]);

  return {
    messages,
    setMessages,
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
