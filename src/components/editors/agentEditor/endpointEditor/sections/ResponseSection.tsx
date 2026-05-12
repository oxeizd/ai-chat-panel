import React from 'react';
import { Field, Input } from '@grafana/ui';
import { EndpointConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface ResponseHandlingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const ResponseHandlingSection: React.FC<ResponseHandlingSectionProps> = ({ endpoint, onChange }) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      <CommaSeparatedInput
        label="Save fields to context"
        value={endpoint.saveToContext || []}
        onChange={(values) => onChange('saveToContext', values)}
        placeholder="thread_id, run_id, user_id"
        description="These fields will be available in subsequent requests"
      />
      <Field label="Chat reply field">
        <Input
          value={endpoint.replyField || ''}
          onChange={(e) => onChange('replyField', e.currentTarget.value)}
          placeholder="text, message, content"
        />
      </Field>
    </div>
  );
};
