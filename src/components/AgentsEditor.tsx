import React, { useState } from 'react';
import { Button, Input, TextArea, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { AgentConfig } from 'types';

interface Props {
  value?: AgentConfig[];
  onChange: (value: AgentConfig[]) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(2)};
    border-radius: ${theme.shape.borderRadius(1)};
    margin-top: ${theme.spacing(1)};
  `,
  row: css`
    margin-bottom: ${theme.spacing(2)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    padding-bottom: ${theme.spacing(2)};
    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
  `,
  field: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  buttonRow: css`
    display: flex;
    gap: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
  `,
});

export const AgentsEditor: React.FC<Props> = ({ value = [], onChange }) => {
  const styles = useStyles2(getStyles);
  const [agents, setAgents] = useState<AgentConfig[]>(value);

  const updateAgents = (newAgents: AgentConfig[]) => {
    setAgents(newAgents);
    onChange(newAgents);
  };

  const addAgent = () => {
    const newAgent: AgentConfig = { name: '', api: '', config: '' };
    updateAgents([...agents, newAgent]);
  };

  const removeAgent = (index: number) => {
    const newAgents = [...agents];
    newAgents.splice(index, 1);
    updateAgents(newAgents);
  };

  const updateAgent = (index: number, field: keyof AgentConfig, fieldValue: string) => {
    const newAgents = [...agents];
    newAgents[index] = { ...newAgents[index], [field]: fieldValue };
    updateAgents(newAgents);
  };

  if (!agents.length) {
    return (
      <div>
        <Button variant="secondary" onClick={addAgent} size="sm" icon="plus">
          Add agent
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {agents.map((agent, idx) => (
        <div key={idx} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={agent.name}
              onChange={(e) => updateAgent(idx, 'name', e.currentTarget.value)}
              placeholder="Agent name"
              label="Name"
            />
          </div>
          <div className={styles.field}>
            <Input
              value={agent.api}
              onChange={(e) => updateAgent(idx, 'api', e.currentTarget.value)}
              placeholder="https://api.example.com/chat"
              label="API endpoint"
            />
          </div>
          <div className={styles.field}>
            <TextArea
              value={agent.config}
              onChange={(e) => updateAgent(idx, 'config', e.currentTarget.value)}
              placeholder='{"temperature": 0.7, "model": "gpt-4"}'
              label="Config (JSON, optional)"
              rows={2}
            />
          </div>
          <div className={styles.buttonRow}>
            <Button variant="destructive" size="sm" onClick={() => removeAgent(idx)} icon="trash-alt">
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={addAgent} size="sm" icon="plus">
        Add agent
      </Button>
    </div>
  );
};