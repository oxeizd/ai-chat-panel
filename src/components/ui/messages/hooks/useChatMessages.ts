import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentConfig, ChatHistoryItem, Message } from 'types';
import { GrafanaUser } from 'components/hooks/useGrafanaUser';
import { dotGet } from 'components/agent/utils/utils';
import {
  DEFAULT_HISTORY_LIST_ITEM_FIELDS,
  DEFAULT_HISTORY_MESSAGE_FIELDS,
  DEFAULT_THREAD_ID_PARAM,
} from 'components/agent/config/agentConfig';
import { useMessageSender } from './useMessageSender';
import { useMessagesState } from './useMessagesState';
import { useDebugTraces } from 'components/ui/debug/hooks/useDebugTraces';
import { parseApiError } from '../../debug/hooks/utils/errorParser';

function formatHistoryDate(value: any): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'number') {
    return new Date(value).toLocaleString();
  }

  const asDate = new Date(value);

  return isNaN(asDate.getTime()) ? String(value) : asDate.toLocaleString();
}

function resolveThreadIdParam(agent: AgentConfig): string {
  return agent.threadIdParam || agent.threadIdContextKey || DEFAULT_THREAD_ID_PARAM;
}

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

  const fetchThreads = useCallback(async (): Promise<ChatHistoryItem[]> => {
    if (!currentAgent?.history || !currentAgent.historyListOperation) {
      return [];
    }

    try {
      const result = await runOperation(currentAgent.historyListOperation);

      if (!Array.isArray(result)) {
        return [];
      }

      const fields = {
        ...DEFAULT_HISTORY_LIST_ITEM_FIELDS,
        ...currentAgent.historyListItemFields,
      };

      return result.map((item: any, index: number) => ({
        id: String(dotGet(item, fields.id) ?? item?.id ?? index),
        title: String(dotGet(item, fields.title) ?? item?.title ?? 'Без названия'),
        date: formatHistoryDate(dotGet(item, fields.date) ?? item?.date),
        preview: fields.preview ? dotGet(item, fields.preview) : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch threads:', error);
      return [];
    }
  }, [currentAgent, runOperation]);

  const loadThread = useCallback(
    async (threadIdToLoad: string) => {
      if (!currentAgent?.history || !currentAgent.historyLoadOperation) {
        return;
      }

      try {
        abort();

        const threadIdParam = resolveThreadIdParam(currentAgent);

        const result = await runOperation(currentAgent.historyLoadOperation, {
          [threadIdParam]: threadIdToLoad,
        });

        if (!Array.isArray(result)) {
          console.warn('loadThread: expected array, got', result);
          return;
        }

        const fields = {
          ...DEFAULT_HISTORY_MESSAGE_FIELDS,
          ...currentAgent.historyMessageFields,
        };

        const uiMessages: Message[] = [];
        const historyForContext: Array<{
          role: 'user' | 'assistant';
          content: any;
        }> = [];

        for (const item of result) {
          const rawRole = dotGet(item, fields.role) ?? item?.role;
          const isUser = rawRole === 'user';

          const text = dotGet(item, fields.text) ?? item?.[fields.text] ?? item?.text ?? item?.content ?? '';

          const timestamp = dotGet(item, fields.timestamp) ?? item?.timestamp ?? Date.now();

          const messageId =
            dotGet(item, fields.id) ?? item?.id ?? `hist_${Date.now()}_${Math.random().toString(36).slice(2)}`;

          uiMessages.push({
            id: String(messageId),
            text: typeof text === 'string' ? text : JSON.stringify(text),
            sender: isUser ? 'user' : 'ai',
            timestamp: typeof timestamp === 'number' ? timestamp : Date.parse(timestamp) || Date.now(),
          });

          historyForContext.push({
            role: isUser ? 'user' : 'assistant',
            content: text,
          });
        }

        const threadIdContextKey = currentAgent.threadIdContextKey || 'thread_id';

        setMessages(uiMessages);
        setThreadId(threadIdToLoad);
        setInputValue('');
        setDynamicSuggestions([]);

        setContext({
          __history: historyForContext,
          [threadIdContextKey]: threadIdToLoad,
        });

        markStarted();
      } catch (error) {
        console.error('Failed to load thread:', error);
      }
    },
    [abort, currentAgent, markStarted, runOperation, setContext, setMessages]
  );

  const deleteThread = useCallback(
    async (threadIdToDelete: string): Promise<boolean | null> => {
      if (!currentAgent?.history || !currentAgent.historyDeleteOperation) {
        return null;
      }

      try {
        const threadIdParam = resolveThreadIdParam(currentAgent);

        await runOperation(currentAgent.historyDeleteOperation, {
          [threadIdParam]: threadIdToDelete,
        });

        return true;
      } catch (error) {
        console.error('Failed to delete thread:', error);
        return false;
      }
    },
    [currentAgent, runOperation]
  );

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
    fetchThreads,
    loadThread,
    deleteThread,
    dynamicSuggestions,
  };
};
