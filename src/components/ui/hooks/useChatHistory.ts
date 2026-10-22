import { useCallback, useSyncExternalStore } from 'react';
import { ChatHistoryItem, Message } from 'types';
import { useChatActions } from '../chat/ChatContext';
import { dotGet } from 'components/agent/utils/utils';
import {
  DEFAULT_HISTORY_LIST_ITEM_FIELDS,
  DEFAULT_HISTORY_MESSAGE_FIELDS,
  DEFAULT_THREAD_ID_PARAM,
} from 'components/agent/config/agentConfig';

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

function resolveThreadIdParam(agent: any): string {
  return agent?.threadIdParam || agent?.threadIdContextKey || DEFAULT_THREAD_ID_PARAM;
}

interface ChatHistoryStoreState {
  historyChats: ChatHistoryItem[];
  isHistoryModalOpen: boolean;
  isLoading: boolean;
}

let state: ChatHistoryStoreState = {
  historyChats: [],
  isHistoryModalOpen: false,
  isLoading: false,
};

const listeners = new Set<() => void>();

const setState = (partial: Partial<ChatHistoryStoreState>) => {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

export const useChatHistory = () => {
  const {
    setMessages,
    setInputValue,
    setContext,
    markStarted,
    runOperation,
    openChat,
    selectedAgent,
  } = useChatActions();

  // Подписка на общий стор — при любом setState все компоненты, вызвавшие
  // этот хук, перерендерятся с актуальным снапшотом.
  const { historyChats, isHistoryModalOpen, isLoading } = useSyncExternalStore(subscribe, getSnapshot);

  const fetchThreads = useCallback(async (): Promise<ChatHistoryItem[]> => {
    if (!selectedAgent?.history || !selectedAgent.historyListOperation) {
      return [];
    }

    try {
      const result = await runOperation(selectedAgent.historyListOperation);

      // Support wrapped responses like { items: [...], total: N }
      const items = Array.isArray(result) ? result : result?.items ?? [];

      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const fields = {
        ...DEFAULT_HISTORY_LIST_ITEM_FIELDS,
        ...selectedAgent.historyListItemFields,
      };

      return items.map((item: any, index: number) => ({
        id: String(dotGet(item, fields.id) ?? item?.id ?? index),
        title: String(dotGet(item, fields.title) ?? item?.title ?? 'Без названия'),
        date: formatHistoryDate(dotGet(item, fields.date) ?? item?.date),
        preview: fields.preview ? dotGet(item, fields.preview) : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch threads:', error);
      return [];
    }
  }, [selectedAgent, runOperation]);

  const loadHistory = useCallback(async () => {
    setState({ isLoading: true });
    try {
      const threads = await fetchThreads();
      setState({ historyChats: threads });
    } catch (err) {
      console.error('Failed to load threads', err);
      setState({ historyChats: [] });
    } finally {
      setState({ isLoading: false });
    }
  }, [fetchThreads]);

  const loadThread = useCallback(
    async (threadIdToLoad: string) => {
      if (!selectedAgent?.history || !selectedAgent.historyLoadOperation) {
        return;
      }

      try {
        const threadIdParam = resolveThreadIdParam(selectedAgent);

        const result = await runOperation(selectedAgent.historyLoadOperation, {
          [threadIdParam]: threadIdToLoad,
        });

        // Support wrapped responses like { messages: [...], thread_id: "..." }
        const messages = Array.isArray(result) ? result : result?.messages ?? [];

        if (!Array.isArray(messages) || messages.length === 0) {
          console.warn('loadThread: expected array, got', result);
          return;
        }

        const fields = {
          ...DEFAULT_HISTORY_MESSAGE_FIELDS,
          ...selectedAgent.historyMessageFields,
        };

        const uiMessages: Message[] = [];
        const historyForContext: Array<{
          role: 'user' | 'assistant';
          content: any;
        }> = [];

        for (const item of messages) {
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

        const threadIdContextKey = selectedAgent.threadIdContextKey || 'thread_id';

        setMessages(uiMessages);
        setInputValue('');
        setContext({
          __history: historyForContext,
          [threadIdContextKey]: threadIdToLoad,
        });

        markStarted();
      } catch (error) {
        console.error('Failed to load thread:', error);
      }
    },
    [selectedAgent, runOperation, setMessages, setInputValue, setContext, markStarted]
  );

  const deleteThread = useCallback(
    async (threadIdToDelete: string): Promise<boolean | null> => {
      if (!selectedAgent?.history || !selectedAgent.historyDeleteOperation) {
        return null;
      }

      try {
        const threadIdParam = resolveThreadIdParam(selectedAgent);

        await runOperation(selectedAgent.historyDeleteOperation, {
          [threadIdParam]: threadIdToDelete,
        });

        return true;
      } catch (error) {
        console.error('Failed to delete thread:', error);
        return false;
      }
    },
    [selectedAgent, runOperation]
  );

  const openHistoryModal = useCallback(() => {
    setState({ isHistoryModalOpen: true });
    loadHistory();
  }, [loadHistory]);

  const closeHistoryModal = useCallback(() => {
    setState({ isHistoryModalOpen: false });
  }, []);

  const selectChat = useCallback(
    async (chatId: string) => {
      await loadThread(chatId);
      openChat();
      closeHistoryModal();
    },
    [loadThread, openChat, closeHistoryModal]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      const result = await deleteThread(chatId);
      if (result === false) {
        console.warn(`Не удалось удалить тред "${chatId}" на backend — убираю только из локального списка`);
      }
      setState({ historyChats: state.historyChats.filter((c) => c.id !== chatId) });
    },
    [deleteThread]
  );

  return {
    historyChats,
    isHistoryModalOpen,
    isLoading,
    openHistoryModal,
    closeHistoryModal,
    selectChat,
    deleteChat,
    hasDeleteOperation: !!selectedAgent?.historyDeleteOperation,
  };
};
