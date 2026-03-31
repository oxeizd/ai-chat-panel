import React, { useState } from 'react';
import { Button, Input, TextArea, Checkbox } from '@grafana/ui';
import { AgentConfig } from '../types';

interface AgentsEditorProps {
  value?: AgentConfig[];
  onChange: (value: AgentConfig[]) => void;
}

export const AgentsEditor: React.FC<AgentsEditorProps> = ({ value = [], onChange }) => {
  const [agents, setAgents] = useState<AgentConfig[]>(value);

  const updateAgents = (newAgents: AgentConfig[]) => {
    setAgents(newAgents);
    onChange(newAgents);
  };

  const addAgent = () => {
    const newAgent: AgentConfig = {
      name: 'Новый агент',
      api: '',
      config: '',
      default: agents.length === 0,
    };
    updateAgents([...agents, newAgent]);
  };

  const removeAgent = (index: number) => {
    const newAgents = agents.filter((_, i) => i !== index);
    if (agents[index].default && newAgents.length > 0) {
      newAgents[0].default = true;
    }
    updateAgents(newAgents);
  };

  const updateAgent = (index: number, field: keyof AgentConfig, fieldValue: any) => {
    const newAgents = [...agents];
    newAgents[index] = { ...newAgents[index], [field]: fieldValue };

    if (field === 'default' && fieldValue === true) {
      newAgents.forEach((agent, i) => {
        if (i !== index) {
          agent.default = false;
        }
      });
    }

    updateAgents(newAgents);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {agents.map((agent, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '12px',
            position: 'relative',
          }}
        >
          <Button
            variant="destructive"
            size="sm"
            icon="trash-alt"
            onClick={() => removeAgent(idx)}
            style={{ position: 'absolute', top: '8px', right: '8px' }}
            aria-label="Удалить агента"
          />
          <div style={{ marginBottom: '8px' }}>
            <Input
              label="Имя агента"
              value={agent.name}
              onChange={(e) => updateAgent(idx, 'name', e.currentTarget.value)}
              placeholder="Например: GPT-4"
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <Input
              label="API эндпоинт"
              value={agent.api}
              onChange={(e) => updateAgent(idx, 'api', e.currentTarget.value)}
              placeholder="https://..."
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <TextArea
              label="Дополнительная конфигурация (JSON)"
              value={agent.config || ''}
              onChange={(e) => updateAgent(idx, 'config', e.currentTarget.value)}
              placeholder='{"temperature": 0.7, "model": "gpt-4"}'
              rows={3}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Checkbox
              label="Агент по умолчанию"
              value={agent.default}
              onChange={(e) => updateAgent(idx, 'default', e.currentTarget.checked)}
            />
          </div>
        </div>
      ))}
      <Button icon="plus" onClick={addAgent} variant="secondary">
        Добавить агента
      </Button>
    </div>
  );
};
