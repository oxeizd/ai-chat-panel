import React from 'react';
import { Switch, Field, Input, useTheme2 } from '@grafana/ui';
import { EndpointConfig, PollingConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface PollingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const PollingSection: React.FC<PollingSectionProps> = ({ endpoint, onChange }) => {
  const theme = useTheme2();
  const polling = endpoint.polling || { enabled: false };

  const handlePollingChange = (enabled: boolean) => {
    onChange('polling', { ...polling, enabled });
  };

  const handlePollingFieldChange = (field: keyof PollingConfig, val: any) => {
    onChange('polling', { ...polling, [field]: val });
  };

  const handleRetryStatusCodesChange = (values: string[]) => {
    const codes = values.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
    handlePollingFieldChange('retryStatusCodes', codes);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>⏱ Result polling</div>
        <Switch value={polling.enabled || false} onChange={(e) => handlePollingChange(e.currentTarget.checked)} />
      </div>
      {polling.enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <Field label="Interval (ms)">
            <Input
              type="number"
              value={polling.intervalMs ?? 1000}
              onChange={(e) => handlePollingFieldChange('intervalMs', parseInt(e.currentTarget.value, 10))}
            />
          </Field>
          <Field label="Max attempts">
            <Input
              type="number"
              value={polling.maxAttempts ?? 10}
              onChange={(e) => handlePollingFieldChange('maxAttempts', parseInt(e.currentTarget.value, 10))}
            />
          </Field>
          <Field label="Status field">
            <Input
              value={polling.statusField ?? 'status'}
              onChange={(e) => handlePollingFieldChange('statusField', e.currentTarget.value)}
            />
          </Field>
          <Field label="Success value">
            <Input
              value={polling.successValue ?? 'completed'}
              onChange={(e) => handlePollingFieldChange('successValue', e.currentTarget.value)}
            />
          </Field>
          <Field label="Result field">
            <Input
              value={polling.resultField ?? 'result'}
              onChange={(e) => handlePollingFieldChange('resultField', e.currentTarget.value)}
            />
          </Field>
          <Field label="Retry HTTP statuses">
            <CommaSeparatedInput
              value={(polling.retryStatusCodes || []).map(String)}
              onChange={handleRetryStatusCodesChange}
              placeholder="202, 404, 409"
            />
          </Field>
        </div>
      )}
    </div>
  );
};
