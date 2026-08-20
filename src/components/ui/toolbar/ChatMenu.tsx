import React from 'react';
import { Menu } from '@grafana/ui';
import { useChatState, useChatActions } from '../chat/ChatContext';
import { useChatHistory } from '../hooks/useChatHistory';

interface ChatMenuProps {
  className?: string;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({ className }) => {
  const { isLoading } = useChatState();
  const { clearChat, exportChat, setSelectedAgent, selectedAgent, agents, newChat } = useChatActions();
  const { openHistoryModal } = useChatHistory();

  return (
    <Menu className={className}>
      {isLoading && <Menu.Item label="Отправка..." disabled icon="spinner" />}

      {selectedAgent?.history && (
        <>
          <Menu.Item label="История" icon="history" onClick={openHistoryModal} disabled={isLoading} />
          <Menu.Divider />
        </>
      )}

      <Menu.Item label="Новый чат" icon="plus" onClick={newChat} disabled={isLoading} />
      <Menu.Divider />

      <Menu.Item label="Очистить чат" icon="trash-alt" onClick={clearChat} disabled={isLoading} />
      <Menu.Divider />

      <Menu.Item label="Экспорт чата" icon="download-alt" onClick={exportChat} disabled={isLoading} />
      <Menu.Divider />

      <Menu.Item label="Выбор агента" icon="user" disabled />

      {agents.map((agent, i) => (
        <React.Fragment key={agent.name}>
          {i > 0 && <Menu.Divider />}
          <Menu.Item
            label={selectedAgent?.name === agent.name ? `${agent.name} ✓` : agent.name}
            icon={selectedAgent?.name === agent.name ? 'check-circle' : 'user'}
            onClick={() => !isLoading && setSelectedAgent(agent)}
            disabled={isLoading}
          />
        </React.Fragment>
      ))}
    </Menu>
  );
};
