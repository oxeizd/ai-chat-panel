import { useCallback, useSyncExternalStore } from 'react';
import { ChatHistoryItem } from 'types';
import { useChatActions } from '../chat/ChatContext';

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
  const { fetchThreads, loadThread, deleteThread, openChat } = useChatActions();

  // Подписка на общий стор — при любом setState все компоненты, вызвавшие
  // этот хук, перерендерятся с актуальным снапшотом.
  const { historyChats, isHistoryModalOpen, isLoading } = useSyncExternalStore(subscribe, getSnapshot);

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
  };
};
