import React from 'react';
import { Menu } from '@grafana/ui';
import { useChatState, useChatActions } from '../chat/ChatContext';

interface ChatMenuProps {
  className?: string;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({ className }) => {
  const { isLoading } = useChatState();
  const { clearChat, exportChat, setSelectedAgent, selectedAgent, agents, newChat } = useChatActions();

  return (
    <Menu className={className}>
      {isLoading && <Menu.Item label="⏳ Отправка..." disabled icon="fa fa-spinner" />}
      {/* <Menu.Item label="История" onClick={clearChat} disabled={isLoading} />
      <Menu.Divider /> */}
      <Menu.Item label="Новый чат" onClick={newChat} disabled={isLoading} />
      <Menu.Divider />
      <Menu.Item label="Очистить чат" onClick={clearChat} disabled={isLoading} />
      <Menu.Divider />
      <Menu.Item label="Экспорт чата" onClick={exportChat} disabled={isLoading} />
      <Menu.Divider />
      <Menu.Item label="Выбор агента" disabled />
      {agents.map((agent, i) => (
        <React.Fragment key={agent.name}>
          {i > 0 && <Menu.Divider />}
          <Menu.Item
            label={selectedAgent?.name === agent.name ? `${agent.name} ✓` : agent.name}
            onClick={() => !isLoading && setSelectedAgent(agent)}
            disabled={isLoading}
          />
        </React.Fragment>
      ))}
    </Menu>
  );
};
