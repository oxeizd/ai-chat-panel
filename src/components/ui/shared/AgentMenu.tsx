import React from 'react';
import { Menu } from '@grafana/ui';
import { AgentConfig } from 'types';

interface AgentMenuProps {
  agents: AgentConfig[];
  selectedAgent: AgentConfig | null;
  onSelectAgent: (agent: AgentConfig) => void;
  className?: string;
}

export const AgentMenu: React.FC<AgentMenuProps> = ({ agents, selectedAgent, onSelectAgent, className }) => (
  <Menu className={className}>
    {agents.map((agent) => (
      <Menu.Item
        key={agent.name}
        label={selectedAgent?.name === agent.name ? `${agent.name}\u00A0✔` : agent.name}
        onClick={() => onSelectAgent(agent)}
      />
    ))}
  </Menu>
);
