import React from 'react';

import { HistoryModal } from '../chatPanel/HistoryModal';
import { useChatHistory } from '../hooks/useChatHistory';

export const ChatHistoryModalHost: React.FC = () => {
  const { historyChats, isHistoryModalOpen, selectChat, deleteChat, closeHistoryModal, hasDeleteOperation } =
    useChatHistory();

  return (
    <HistoryModal
      isOpen={isHistoryModalOpen}
      onClose={closeHistoryModal}
      historyChats={historyChats}
      onSelectChat={selectChat}
      onDeleteChat={deleteChat}
      hasDeleteOperation={hasDeleteOperation}
    />
  );
};
