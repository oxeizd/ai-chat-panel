import { useCallback, useSyncExternalStore } from 'react';
import { ChatHistoryItem } from 'types';
import { useChatActions } from '../chat/ChatContext';

// Мини "внешний стор" — состояние живёт вне React-дерева, в замыкании модуля.
// Все компоненты, которые зовут useChatHistory(), подписываются на один и тот
// же объект и получают одинаковый historyChats / isHistoryModalOpen /
// isLoading без Context.Provider и без прокидывания пропсов.

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
  const { fetchThreads, loadThread, deleteThread } = useChatActions();

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
      closeHistoryModal();
    },
    [loadThread, closeHistoryModal]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      // Если у агента настроена historyDeleteOperation — пытаемся удалить и там.
      // Если операция не настроена (deleteThread возвращает null) или упала
      // (false) — всё равно убираем элемент из локального списка, как и раньше,
      // просто теперь при неудачном сетевом удалении явно логируем причину.
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
