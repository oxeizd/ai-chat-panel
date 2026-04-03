import React, { useState } from 'react';
import { Button, useTheme2 } from '@grafana/ui';
import { AgentConfig } from 'types';
import { AgentEditModal } from './AgentEditModal';

interface AgentsEditorProps {
  value?: AgentConfig[];
  onChange: (value: AgentConfig[]) => void;
}

export const AgentsEditor: React.FC<AgentsEditorProps> = ({ value = [], onChange }) => {
  const [agents, setAgents] = useState<AgentConfig[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const theme = useTheme2();

  const updateAgents = (newAgents: AgentConfig[]) => {
    setAgents(newAgents);
    onChange(newAgents);
  };

  const handleAdd = () => {
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleSave = (agent: AgentConfig) => {
    if (editingIndex === null) {
      let newAgents = [...agents, agent];
      if (agent.default) {
        newAgents = newAgents.map((a, i) => (i === newAgents.length - 1 ? a : { ...a, default: false }));
      }
      updateAgents(newAgents);
    } else {
      const newAgents = [...agents];
      newAgents[editingIndex] = agent;
      if (agent.default) {
        for (let i = 0; i < newAgents.length; i++) {
          if (i !== editingIndex) {
            newAgents[i] = { ...newAgents[i], default: false };
          }
        }
      }
      updateAgents(newAgents);
    }
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    const newAgents = agents.filter((_, i) => i !== index);
    if (agents[index].default && newAgents.length > 0) {
      newAgents[0] = { ...newAgents[0], default: true };
    }
    updateAgents(newAgents);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {agents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {agents.map((agent, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border.weak}`,
                borderRadius: theme.shape.radius.default,
                padding: '12px 16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border.strong;
                e.currentTarget.style.background = theme.colors.background.secondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border.weak;
                e.currentTarget.style.background = theme.colors.background.primary;
              }}
            >
              <div
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}
              >
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name}
                </div>
                {agent.default && (
                  <div
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: theme.colors.primary.main,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    default
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button
                  icon="edit"
                  onClick={() => handleEdit(idx)}
                  variant="secondary"
                  size="sm"
                  aria-label="Редактировать"
                />
                <Button
                  icon="trash-alt"
                  onClick={() => handleRemove(idx)}
                  variant="destructive"
                  size="sm"
                  aria-label="Удалить"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button icon="plus" onClick={handleAdd} variant="secondary" style={{ width: '100%' }}>
        add agent
      </Button>

      <AgentEditModal
        key={editingIndex}
        isOpen={isModalOpen}
        agent={editingIndex !== null ? agents[editingIndex] : null}
        onDismiss={() => {
          setIsModalOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};
