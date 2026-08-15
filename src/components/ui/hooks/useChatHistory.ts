import { useState, useCallback } from 'react';
import { ChatHistoryItem } from 'types';
import { useChatActions } from '../chat/ChatContext';

export const useChatHistory = () => {
  const { fetchThreads, loadThread, deleteThread } = useChatActions();
  const [historyChats, setHistoryChats] = useState<ChatHistoryItem[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const threads = await fetchThreads();
      setHistoryChats(threads);
    } catch (err) {
      console.error('Failed to load threads', err);
      setHistoryChats([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchThreads]);

  const openHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(true);
    loadHistory();
  }, [loadHistory]);

  const closeHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false);
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
      setHistoryChats((prev) => prev.filter((c) => c.id !== chatId));
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
