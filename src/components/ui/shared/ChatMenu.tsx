import React from 'react';
import { Menu } from '@grafana/ui';
import { AgentConfig } from 'types';

interface ChatMenuProps {
  agents: AgentConfig[];
  onClearChat: () => void;
  onExportChat: () => void;
  onOpenSettings: () => void;
  onSelectAgent: (agent: AgentConfig) => void;
  selectedAgent: AgentConfig | null;
  onNewChat: () => void;
  className?: string;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({
  agents,
  onClearChat,
  onExportChat,
  onOpenSettings,
  onSelectAgent,
  selectedAgent,
  onNewChat,
  className,
}) => (
  <Menu className={className}>
    <Menu.Item label="Очистить чат" onClick={onClearChat} />
    <Menu.Item label="Новый чат" onClick={onNewChat} />
    <Menu.Divider />
    <Menu.Item label="Экспорт чата" onClick={onExportChat} />
    <Menu.Divider />
    <Menu.Item label="Выбор агента" disabled />
    {agents.map((agent) => (
      <Menu.Item
        key={agent.name}
        label={selectedAgent?.name === agent.name ? `${agent.name}\u00A0✔` : agent.name}
        onClick={() => onSelectAgent(agent)}
      />
    ))}
    <Menu.Divider />
  </Menu>
);
