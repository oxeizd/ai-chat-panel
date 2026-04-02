import React from 'react';
import { Button, Dropdown } from '@grafana/ui';
import { AgentMenu } from './AgentMenu';
import { AgentConfig } from 'types';

interface BottomButtonsProps {
  selectedAgent: AgentConfig;
  agents: AgentConfig[];
  onSelectAgent: (agent: AgentConfig) => void;
  onNewChat: () => void;
  agentButtonClassName: string;
  newChatButtonClassName: string;
  menuClassName: string;
}

export const BottomButtons: React.FC<BottomButtonsProps> = ({
  selectedAgent,
  agents,
  onSelectAgent,
  onNewChat,
  agentButtonClassName,
  newChatButtonClassName,
  menuClassName,
}) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    <Dropdown
      overlay={<AgentMenu agents={agents} onSelectAgent={onSelectAgent} className={menuClassName} />}
      placement="top-start"
    >
      <Button variant="secondary" size="sm" className={agentButtonClassName} icon="user">
        {selectedAgent.name}
      </Button>
    </Dropdown>
    <Button variant="secondary" size="sm" icon="plus" onClick={onNewChat} className={newChatButtonClassName}>
      Новый чат
    </Button>
  </div>
);
