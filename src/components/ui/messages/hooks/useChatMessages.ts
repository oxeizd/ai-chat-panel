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
    return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null, debug: boolean) => {
  const resettingRef = useRef(false);
  const [inputValue, setInputValue] = useState('');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  const {
    messages,
    addUserMessage,
    setMessages,
    addAssistantPlaceholder,
    updateAssistantText,
    updateAssistantThinking,
    setAssistantThinkingDone,
    setAssistantFinal,
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
  } = useMessageSender({ agent: currentAgent, user });
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  useEffect(() => {
    const key = currentAgent?.dynamicSuggestionsContextKey;
    if (!onContextUpdate || !key) {
      // Синхронный сброс здесь легитимен: это не "синхронизация с внешней
      // системой" в теле эффекта, а просто очистка локального состояния при
      // смене агента на тот, где динамические подсказки не настроены —
      // без этого остались бы висеть подсказки от предыдущего агента.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDynamicSuggestions([]);
      return;
    }
    const unsub = onContextUpdate((ctx) => {
      setDynamicSuggestions(normalizeDynamicSuggestions(ctx?.[key]));
    });
    return unsub;
  }, [onContextUpdate, currentAgent?.dynamicSuggestionsContextKey]);

  const sendText = useCallback(
    async (text: string, options?: { replaceUserMessageId?: string }): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || !currentAgent || isSending) {
        return false;
      }

      let userMessageId: string;
      if (options?.replaceUserMessageId) {
        const index = messages.findIndex((m) => m.id === options.replaceUserMessageId);
        if (index === -1) {
          return false;
        }
        pruneFrom(index);
        const newUserMsg = addUserMessage(trimmed);
        userMessageId = newUserMsg.id;
        removeTrace(options.replaceUserMessageId);
      } else {
        const newUserMsg = addUserMessage(trimmed);
        userMessageId = newUserMsg.id;
      }

      const assistantPlaceholder = addAssistantPlaceholder();
      const assistantId = assistantPlaceholder.id;
      const trace = create(userMessageId, trimmed);

      try {
        const reply = await send(trimmed, {
          onChunk: (chunk: string) => {
            updateAssistantText(assistantId, (prev) => prev + chunk);
          },
          onReasoningChunk: (chunk: string) => {
            updateAssistantThinking(assistantId, chunk);
          },
          onReasoningComplete: (full: string) => {
            setAssistantThinkingDone(assistantId, full);
          },
          onStep: (step: any) => {
            if (trace) {
              addStep(userMessageId, step);
            }
          },
          onFileAttachment: (file: any) => {
            setAssistantFinal(assistantId, undefined, file);
          },
        });

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
          runOperation(currentAgent.suggestionsOperation).catch((err) => {
            console.error('Failed to fetch dynamic suggestions:', err);
          });
        }

        return true;
      } catch (err) {
        removeAssistant(assistantId);
        const parsed = parseApiError(err);
        if (trace) {
          setError(userMessageId, parsed);
        }
        markUserError(userMessageId, parsed);
        addErrorAsAi(parsed.message, parsed);
        return false;
      }
    },
    [
      addStep,
      currentAgent,
      isSending,
      messages,
      pruneFrom,
      addUserMessage,
      removeTrace,
      addAssistantPlaceholder,
      create,
      updateAssistantText,
      updateAssistantThinking,
      setAssistantThinkingDone,
      send,
      removeAssistant,
      setAssistantFinal,
      setReply,
      markUserError,
      addErrorAsAi,
      setError,
      getThreadId,
      runOperation,
    ]
  );

  const sendMessage = useCallback(
    (customText?: string) => {
      const text = customText !== undefined ? customText : inputValue;
      if (text.trim()) {
        sendText(text);
        if (customText === undefined) {
          setInputValue('');
        }
      }
    },
    [inputValue, sendText]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isSending) {
        return;
      }

      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1 || messages[index].sender !== 'user') {
        return;
      }
      const originalText = messages[index].text;
      await sendText(originalText, { replaceUserMessageId: messageId });
    },
    [messages, sendText, isSending]
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
      } catch (err) {
        console.warn('Failed to reset session on backend', err);
      }

      if (currentAgent?.suggestionsSource === 'dynamic_once' && currentAgent.suggestionsOperation) {
        runOperation(currentAgent.suggestionsOperation).catch((err) => {
          console.error('Failed to fetch initial suggestions:', err);
        });
      }
    } finally {
      resettingRef.current = false;
    }
  }, [abort, resetMessages, resetSession, currentAgent, runOperation]);

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

      const fields = { ...DEFAULT_HISTORY_LIST_ITEM_FIELDS, ...currentAgent.historyListItemFields };

      return result.map((item: any, idx: number) => ({
        id: String(dotGet(item, fields.id) ?? item?.id ?? idx),
        title: String(dotGet(item, fields.title) ?? item?.title ?? 'Без названия'),
        date: formatHistoryDate(dotGet(item, fields.date) ?? item?.date),
        preview: fields.preview ? dotGet(item, fields.preview) : undefined,
      }));
    } catch (err) {
      console.error('Failed to fetch threads:', err);
      return [];
    }
  }, [currentAgent, runOperation]);

  const loadThread = useCallback(
    async (threadIdToLoad: string) => {
      if (!currentAgent?.history || !currentAgent.historyLoadOperation) {
        return;
      }
      try {
        const param = resolveThreadIdParam(currentAgent);
        const result = await runOperation(currentAgent.historyLoadOperation, { [param]: threadIdToLoad });

        if (!Array.isArray(result)) {
          console.warn('loadThread: expected array, got', result);
          return;
        }

        const fields = { ...DEFAULT_HISTORY_MESSAGE_FIELDS, ...currentAgent.historyMessageFields };

        const uiMessages: Message[] = [];
        const historyForContext: Array<{ role: string; content: any }> = [];

        for (const item of result) {
          const rawRole = dotGet(item, fields.role) ?? item?.role;
          const isUser = rawRole === 'user';
          const text = dotGet(item, fields.text) ?? item?.[fields.text] ?? item?.text ?? item?.content ?? '';
          const timestamp = dotGet(item, fields.timestamp) ?? item?.timestamp ?? Date.now();
          const id = dotGet(item, fields.id) ?? item?.id ?? `hist_${Date.now()}_${Math.random()}`;

          uiMessages.push({
            id: String(id),
            text: typeof text === 'string' ? text : JSON.stringify(text),
            sender: isUser ? 'user' : 'ai',
            timestamp: typeof timestamp === 'number' ? timestamp : Date.parse(timestamp) || Date.now(),
          });

          historyForContext.push({
            role: isUser ? 'user' : 'assistant',
            content: text,
          });
        }

        setMessages(uiMessages);
        setThreadId(threadIdToLoad);

        const threadIdContextKey = currentAgent.threadIdContextKey || 'thread_id';
        setContext({
          __history: historyForContext,
          [threadIdContextKey]: threadIdToLoad,
        });
      } catch (err) {
        console.error('Failed to load thread:', err);
      }
    },
    [currentAgent, runOperation, setMessages, setContext]
  );

  const deleteThread = useCallback(
    async (threadIdToDelete: string): Promise<boolean | null> => {
      if (!currentAgent?.history || !currentAgent.historyDeleteOperation) {
        return null;
      }
      try {
        const param = resolveThreadIdParam(currentAgent);
        await runOperation(currentAgent.historyDeleteOperation, { [param]: threadIdToDelete });
        return true;
      } catch (err) {
        console.error('Failed to delete thread:', err);
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
