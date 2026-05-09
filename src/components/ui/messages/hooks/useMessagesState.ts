import { useState, useCallback } from 'react';
import { Message } from 'types';
import { generateMessageId } from './utils/idGenerators';

export const useMessagesState = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const addUserMessage = useCallback((text: string): Message => {
    const msg: Message = {
      id: generateMessageId(),
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const addAssistantPlaceholder = useCallback((): Message => {
    const msg: Message = {
      id: generateMessageId(),
      text: '',
      sender: 'ai',
      timestamp: Date.now(),
      thinking: '',
      isThinking: false,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const updateAssistantText = useCallback((assistantId: string, updater: string | ((prev: string) => string)) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId && msg.sender === 'ai'
          ? { ...msg, text: typeof updater === 'function' ? updater(msg.text) : updater }
          : msg
      )
    );
  }, []);

  /**
   * Добавляет чанк (или накапливает) в поле `thinking` ассистента.
   * Устанавливает флаг `isThinking: true`.
   */
  const updateAssistantThinking = useCallback(
    (assistantId: string, chunkOrUpdater: string | ((prev: string) => string)) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && msg.sender === 'ai'
            ? {
                ...msg,
                thinking:
                  typeof chunkOrUpdater === 'function'
                    ? chunkOrUpdater(msg.thinking || '')
                    : (msg.thinking || '') + chunkOrUpdater,
                isThinking: true,
              }
            : msg
        )
      );
    },
    []
  );

  /**
   * Финализирует процесс рассуждения: записывает полный текст и снимает флаг isThinking.
   */
  const setAssistantThinkingDone = useCallback((assistantId: string, finalThinking: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId && msg.sender === 'ai' ? { ...msg, thinking: finalThinking, isThinking: false } : msg
      )
    );
  }, []);

  const setAssistantFinal = useCallback((assistantId: string, finalText: string, fileAttachment?: any) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId && msg.sender === 'ai'
          ? { ...msg, text: finalText, fileAttachment: fileAttachment || msg.fileAttachment }
          : msg
      )
    );
  }, []);

  const removeAssistant = useCallback((assistantId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
  }, []);

  const addErrorAsAi = useCallback((errorMessage: string, errorDetails?: any) => {
    const msg: Message = {
      id: generateMessageId(),
      text: `❌ ${errorMessage}`,
      sender: 'ai',
      timestamp: Date.now(),
      errorDetails,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const markUserError = useCallback((userMessageId: string, errorDetails: any) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === userMessageId && msg.sender === 'user' ? { ...msg, error: true, errorDetails } : msg
      )
    );
  }, []);

  const pruneFrom = useCallback((fromIndex: number) => {
    setMessages((prev) => prev.slice(0, fromIndex));
  }, []);

  const resetMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    addUserMessage,
    addAssistantPlaceholder,
    setMessages,
    updateAssistantText,
    updateAssistantThinking,
    setAssistantThinkingDone,
    setAssistantFinal,
    removeAssistant,
    addErrorAsAi,
    markUserError,
    pruneFrom,
    resetMessages,
  };
};
