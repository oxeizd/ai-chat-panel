import { useState, useCallback } from 'react';
import { useChatActions } from '../chat/ChatContext';

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  preview?: string;
}

export const useChatHistory = () => {
  const { fetchThreads, loadThread } = useChatActions();
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

  const deleteChat = useCallback(async (chatId: string) => {
    // Локальное удаление из списка (без API)
    setHistoryChats((prev) => prev.filter((c) => c.id !== chatId));
    // При необходимости можно добавить реальную операцию удаления
  }, []);

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
