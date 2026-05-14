import { useState, useCallback } from 'react';

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  preview?: string;
}

export const useChatHistory = () => {
  // Список диалогов
  const [historyChats, setHistoryChats] = useState<ChatHistoryItem[]>([]);
  // Состояние модального окна
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Загрузка истории (заглушка)
  const loadHistory = useCallback(async () => {
    // TODO: реальный запрос
    setHistoryChats([
      { id: '1', title: 'Разговор о погоде', date: '2025-01-20', preview: 'Сегодня солнечно...' },
      { id: '2', title: 'Помощь с кодом', date: '2025-01-19', preview: 'Как правильно использовать хуки?' },
    ]);
  }, []);

  // Выбор диалога
  const selectChat = useCallback((chatId: string) => {
    console.log('Выбран чат', chatId);
    // TODO: загрузить сообщения выбранного чата
  }, []);

  // Удаление диалога
  const deleteChat = useCallback(async (chatId: string) => {
    console.log('Удалён чат', chatId);
    setHistoryChats((prev) => prev.filter((c) => c.id !== chatId));
    // TODO: вызов API удаления
  }, []);

  // Открыть модалку (и загрузить историю)
  const openHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(true);
    loadHistory();
  }, [loadHistory]);

  // Закрыть модалку
  const closeHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false);
  }, []);

  return {
    historyChats,
    isHistoryModalOpen,
    loadHistory, // может понадобиться для ручной перезагрузки
    selectChat,
    deleteChat,
    openHistoryModal,
    closeHistoryModal,
  };
};
