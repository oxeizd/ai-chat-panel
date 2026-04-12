import React from 'react';
import { Switch, Field, Input, useTheme2 } from '@grafana/ui';
import { EndpointConfig, StreamingConfig } from 'types';

interface StreamingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const StreamingSection: React.FC<StreamingSectionProps> = ({ endpoint, onChange }) => {
  const theme = useTheme2();

  const isStreamingEnabled = (): boolean => {
    if (!endpoint.streaming) {
      return false;
    }
    if (typeof endpoint.streaming === 'boolean') {
      return endpoint.streaming;
    }
    return endpoint.streaming.enabled === true;
  };

  const getStreamingConfig = (): StreamingConfig | null => {
    if (!endpoint.streaming || typeof endpoint.streaming === 'boolean') {
      return null;
    }
    return endpoint.streaming;
  };

  const handleStreamingChange = (enabled: boolean) => {
    if (enabled) {
      if (!endpoint.streaming || typeof endpoint.streaming === 'boolean') {
        onChange('streaming', {
          enabled: true,
          textPath: 'choices[0].delta.content',
          delimiter: '\n\n',
          dataPrefix: 'data: ',
        });
      } else {
        onChange('streaming', { ...endpoint.streaming, enabled: true });
      }
    } else {
      onChange('streaming', false);
    }
  };

  const handleStreamingFieldChange = (field: keyof StreamingConfig, val: any) => {
    let current = endpoint.streaming;
    if (!current || typeof current === 'boolean') {
      current = { enabled: true };
    }
    onChange('streaming', { ...current, [field]: val });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>📡 Streaming</div>
        <Switch value={isStreamingEnabled()} onChange={(e) => handleStreamingChange(e.currentTarget.checked)} />
      </div>
      {isStreamingEnabled() && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <Field label="Text path">
            <Input
              value={getStreamingConfig()?.textPath ?? 'choices[0].delta.content'}
              onChange={(e) => handleStreamingFieldChange('textPath', e.currentTarget.value)}
            />
          </Field>
          <Field label="Delimiter">
            <Input
              value={getStreamingConfig()?.delimiter ?? '\n\n'}
              onChange={(e) => handleStreamingFieldChange('delimiter', e.currentTarget.value)}
            />
          </Field>
          <Field label="Data prefix">
            <Input
              value={getStreamingConfig()?.dataPrefix ?? 'data: '}
              onChange={(e) => handleStreamingFieldChange('dataPrefix', e.currentTarget.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
};
