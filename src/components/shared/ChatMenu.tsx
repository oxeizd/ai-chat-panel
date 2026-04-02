import React from 'react';
import { Menu } from '@grafana/ui';
import { AgentConfig } from '../../types';

interface ChatMenuProps {
  agents: AgentConfig[];
  onClearChat: () => void;
  onExportChat: () => void;
  onOpenSettings: () => void;
  onSelectAgent: (agent: AgentConfig) => void;
  className?: string;
}

export const ChatMenu: React.FC<ChatMenuProps> = ({
  agents,
  onClearChat,
  onExportChat,
  onOpenSettings,
  onSelectAgent,
  className,
}) => (
  <Menu className={className}>
    <Menu.Item label="Очистить чат" onClick={onClearChat} />
    <Menu.Divider />
    <Menu.Item label="Экспорт чата" onClick={onExportChat} />
    <Menu.Divider />
    <Menu.Item label="Выбор агента" disabled />
    {agents.map((agent) => (
      <Menu.Item key={agent.name} label={agent.name} onClick={() => onSelectAgent(agent)} />
    ))}
    <Menu.Divider />
  </Menu>
);
