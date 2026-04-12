import React from 'react';
import { Collapse } from '@grafana/ui';
import { AgentConfig } from 'types';
import { JsonEditor } from 'components/editors/shared/JsonEditor';

interface AgentJsonSectionProps {
  agent: AgentConfig;
  onChange: (field: keyof AgentConfig, value: any) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AgentJsonSection: React.FC<AgentJsonSectionProps> = ({ agent, onChange, isOpen, onToggle }) => {
  return (
    <Collapse label="Common configuration" isOpen={isOpen} onToggle={onToggle}>
      <div style={{ marginTop: '8px' }}>
        <JsonEditor
          label="Headers"
          value={agent.headers}
          onChange={(newHeaders) => onChange('headers', newHeaders)}
          placeholder='{"Authorization": "Bearer token"}'
          rows={3}
          description="These headers will be added to every request (unless overridden in the endpoint)."
        />
        <JsonEditor
          label="Parameters (JSON object with variables)"
          value={agent.config}
          onChange={(newConfig) => onChange('config', newConfig)}
          placeholder='{"model": "gpt-4", "temperature": 0.7, "id": "${id}"}'
          rows={4}
          description="These parameters will be merged with each request body. Use ${variable} for substitution from context."
        />
      </div>
    </Collapse>
  );
};
