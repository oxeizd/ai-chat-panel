import React from 'react';
import { Input, Field, Checkbox } from '@grafana/ui';
import { AgentConfig } from 'types';

interface AgentCommonSectionProps {
  agent: AgentConfig;
  onChange: (field: keyof AgentConfig, value: any) => void;
}

export const AgentCommonSection: React.FC<AgentCommonSectionProps> = ({ agent, onChange }) => {
  return (
    <>
      <Field label="Name">
        <Input
          value={agent.name}
          onChange={(e) => onChange('name', e.currentTarget.value)}
          placeholder="e.g.: Agent #1"
        />
      </Field>
      <Field label="Base URL">
        <Input
          value={agent.api}
          onChange={(e) => onChange('api', e.currentTarget.value)}
          placeholder="https://api.example.com"
        />
      </Field>
      <Checkbox
        label="Use by default"
        value={agent.default}
        onChange={(e) => onChange('default', e.currentTarget.checked)}
      />
    </>
  );
};
