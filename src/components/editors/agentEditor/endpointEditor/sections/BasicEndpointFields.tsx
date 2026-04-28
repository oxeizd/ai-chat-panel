import React from 'react';
import { Input, Field, Combobox } from '@grafana/ui';
import { EndpointConfig } from 'types';
import { methodOptions } from '../../constants';

interface BasicEndpointFieldsProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const BasicEndpointFields: React.FC<BasicEndpointFieldsProps> = ({ endpoint, onChange }) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      <Field label="Operation name">
        <Input
          value={endpoint.operation || ''}
          onChange={(e) => onChange('operation', e.currentTarget.value)}
          placeholder="e.g.: ask"
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
        <Field label="HTTP method">
          <Combobox
            value={methodOptions.find((opt) => opt.value === endpoint.method) || methodOptions[0]}
            options={methodOptions}
            onChange={(opt) => onChange('method', opt?.value || 'POST')}
          />
        </Field>
        <Field label="Path (can contain variables)">
          <Input
            value={endpoint.path || ''}
            onChange={(e) => onChange('path', e.currentTarget.value)}
            placeholder="/{thread}/messages"
          />
        </Field>
      </div>
    </div>
  );
};
