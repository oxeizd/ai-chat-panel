import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentConfig } from 'types';
import { GrafanaUser } from 'components/hooks/useGrafanaUser';
import { useMessageSender } from './useMessageSender';
import { useMessagesState } from './useMessagesState';
import { useDebugTraces } from 'components/ui/debug/hooks/useDebugTraces';
import { parseApiError } from '../../debug/hooks/utils/errorParser';

function normalizeDynamicSuggestions(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null, debug: boolean) => {
  const resettingRef = useRef(false);

  const [inputValue, setInputValue] = useState('');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);

  const {
    messages,
    addUserMessage,
    setMessages,
    addAssistantPlaceholder,
    updateAssistantText,
    updateAssistantThinking,
    setAssistantThinkingDone,
    setAssistantFinal,
    setAssistantInteractive,
    removeAssistant,
    addErrorAsAi,
    markUserError,
    pruneFrom,
    resetMessages,
  } = useMessagesState();

  const { traces, create, addStep, setReply, setError, remove: removeTrace } = useDebugTraces(debug);

  const {
    send,
    abort,
    reset: resetSession,
    isSending,
    getThreadId,
    setContext,
    onContextUpdate,
    runOperation,
    markStarted,
  } = useMessageSender({
    agent: currentAgent,
    user,
  });

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  useEffect(() => {
    const key = currentAgent?.dynamicSuggestionsContextKey;

    if (!onContextUpdate || !key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDynamicSuggestions([]);
      return;
    }

    const unsubscribe = onContextUpdate((context) => {
      setDynamicSuggestions(normalizeDynamicSuggestions(context?.[key]));
    });

    return unsubscribe;
  }, [onContextUpdate, currentAgent?.dynamicSuggestionsContextKey]);

  const sendText = useCallback(
    async (
      text: string,
      options?: {
        replaceUserMessageId?: string;
        extraContext?: Record<string, any>;
      }
    ): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed || !currentAgent || isSending) {
        return false;
      }

      let userMessageId: string;

      if (options?.replaceUserMessageId) {
        const index = messages.findIndex((message) => message.id === options.replaceUserMessageId);

        if (index === -1) {
          return false;
        }

        pruneFrom(index);

        const newUserMessage = addUserMessage(trimmed);
        userMessageId = newUserMessage.id;

        removeTrace(options.replaceUserMessageId);
      } else {
        const newUserMessage = addUserMessage(trimmed);
        userMessageId = newUserMessage.id;
      }

      const assistantPlaceholder = addAssistantPlaceholder();
      const assistantId = assistantPlaceholder.id;
      const trace = create(userMessageId, trimmed);

      try {
        const reply = await send(
          trimmed,
          {
            onChunk: (chunk: string) => {
              updateAssistantText(assistantId, (previous) => previous + chunk);
            },
            onReasoningChunk: (chunk: string) => {
              updateAssistantThinking(assistantId, chunk);
            },
            onReasoningComplete: (fullReasoning: string) => {
              setAssistantThinkingDone(assistantId, fullReasoning);
            },
            onStep: (step: any) => {
              if (trace) {
                addStep(userMessageId, step);
              }
            },
            onFileAttachment: (file: any) => {
              setAssistantFinal(assistantId, undefined, file);
            },
            onInteractive: (payload: any) => {
              setAssistantInteractive(assistantId, payload);
            },
          },
          options?.extraContext
        );

        const newThreadId = getThreadId();

        if (newThreadId) {
          setThreadId(newThreadId);
        }

        if (reply === null) {
          removeAssistant(assistantId);
          return false;
        }

        setAssistantFinal(assistantId, reply);

        if (trace) {
          setReply(userMessageId, reply);
        }

        if (currentAgent.suggestionsSource === 'dynamic_per_reply' && currentAgent.suggestionsOperation) {
          runOperation(currentAgent.suggestionsOperation).catch((error) => {
            console.error('Failed to fetch dynamic suggestions:', error);
          });
        }

        return true;
      } catch (error) {
        removeAssistant(assistantId);

        const parsedError = parseApiError(error);

        if (trace) {
          setError(userMessageId, parsedError);
        }

        markUserError(userMessageId, parsedError);
        addErrorAsAi(parsedError.message, parsedError);

        return false;
      }
    },
    [
      addAssistantPlaceholder,
      addErrorAsAi,
      addStep,
      addUserMessage,
      create,
      currentAgent,
      getThreadId,
      isSending,
      markUserError,
      messages,
      pruneFrom,
      removeAssistant,
      removeTrace,
      runOperation,
      send,
      setAssistantFinal,
      setAssistantInteractive,
      setAssistantThinkingDone,
      setError,
      setReply,
      updateAssistantText,
      updateAssistantThinking,
    ]
  );

  const sendMessage = useCallback(
    (customText?: string) => {
      const text = customText !== undefined ? customText : inputValue;

      if (!text.trim()) {
        return;
      }

      void sendText(text);

      if (customText === undefined) {
        setInputValue('');
      }
    },
    [inputValue, sendText]
  );

  const sendInteractive = useCallback(
    async (_assistantMessageId: string, text: string, extraContext?: Record<string, any>) => {
      await sendText(text, { extraContext });
    },
    [sendText]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isSending) {
        return;
      }

      const index = messages.findIndex((message) => message.id === messageId);

      if (index === -1 || messages[index].sender !== 'user') {
        return;
      }

      await sendText(messages[index].text, {
        replaceUserMessageId: messageId,
      });
    },
    [isSending, messages, sendText]
  );

  const newChat = useCallback(async () => {
    if (resettingRef.current) {
      return;
    }

    resettingRef.current = true;

    try {
      abort();
      resetMessages();
      setInputValue('');
      setThreadId(null);
      setDynamicSuggestions([]);

      try {
        await resetSession();
      } catch (error) {
        console.warn('Failed to reset session on backend', error);
      }

      if (currentAgent?.suggestionsSource === 'dynamic_once' && currentAgent.suggestionsOperation) {
        runOperation(currentAgent.suggestionsOperation).catch((error) => {
          console.error('Failed to fetch dynamic suggestions:', error);
        });
      }
    } finally {
      resettingRef.current = false;
    }
  }, [abort, currentAgent, resetMessages, resetSession, runOperation]);

  const clearChat = useCallback(() => {
    abort();
    resetMessages();
  }, [abort, resetMessages]);

  const getTrace = useCallback((messageId: string) => traces.get(messageId), [traces]);

  return {
    messages,
    isLoading: isSending,
    inputValue,
    setMessages,
    setInputValue,
    sendMessage,
    sendInteractive,
    clearChat,
    newChat,
    retryMessage,
    traces,
    getTrace,
    threadId,
    setContext,
    markStarted,
    runOperation,
    dynamicSuggestions,
  };
};
