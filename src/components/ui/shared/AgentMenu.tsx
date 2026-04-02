import React from 'react';
import { Menu } from '@grafana/ui';
import { AgentConfig } from 'types';

interface AgentMenuProps {
  agents: AgentConfig[];
  onSelectAgent: (agent: AgentConfig) => void;
  className?: string;
}

export const AgentMenu: React.FC<AgentMenuProps> = ({ agents, onSelectAgent, className }) => (
  <Menu className={className}>
    {agents.map((agent) => (
      <Menu.Item key={agent.name} label={agent.name} onClick={() => onSelectAgent(agent)} />
    ))}
  </Menu>
);
