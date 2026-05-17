import React from 'react';
import { Switch, Field, Input, Combobox } from '@grafana/ui';
import { EndpointConfig, StreamingConfig } from 'types';

interface StreamingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const PARSE_STRATEGY_OPTIONS = [
  { label: 'SSE (Server-Sent Events)', value: 'sse' },
  { label: 'JSON Lines', value: 'jsonl' },
];

function isStreamingEnabled(
  streaming: EndpointConfig['streaming']
): streaming is Extract<StreamingConfig, { enabled: true }> {
  return streaming !== null && typeof streaming === 'object' && streaming.enabled === true;
}

function getStreamingConfig(
  streaming: EndpointConfig['streaming']
): Extract<StreamingConfig, { enabled: true }> | null {
  if (!isStreamingEnabled(streaming)) {
    return null;
  }
  return streaming;
}

export const StreamingSection: React.FC<StreamingSectionProps> = ({ endpoint, onChange }) => {
  const streaming = endpoint.streaming;
  const enabled = isStreamingEnabled(streaming);
  const config = getStreamingConfig(streaming);

  const handleStreamingChange = (checked: boolean) => {
    if (checked) {
      onChange('streaming', {
        enabled: true,
        parseStrategy: 'sse',
        textPath: 'choices[0].delta.content',
        delimiter: '\n\n',
        dataPrefix: 'data: ',
      });
    } else {
      onChange('streaming', { enabled: false });
    }
  };

  const handleStreamingFieldChange = <K extends keyof Extract<StreamingConfig, { enabled: true }>>(
    field: K,
    val: any
  ) => {
    if (!enabled || !config) {
      // fallback: создать базовый конфиг
      const base = { enabled: true, parseStrategy: 'sse' as const };
      onChange('streaming', { ...base, [field]: val });
      return;
    }
    onChange('streaming', { ...config, [field]: val });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>📡 Streaming</div>
        <Switch value={enabled} onChange={(e) => handleStreamingChange(e.currentTarget.checked)} />
      </div>
      {enabled && config && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <Field label="Parse strategy">
            <Combobox
              options={PARSE_STRATEGY_OPTIONS}
              value={config.parseStrategy}
              onChange={(opt) => handleStreamingFieldChange('parseStrategy', opt?.value)}
            />
          </Field>
          <Field label="Text path">
            <Input
              value={config.textPath ?? 'choices[0].delta.content'}
              onChange={(e) => handleStreamingFieldChange('textPath', e.currentTarget.value)}
            />
          </Field>
          <Field label="Delimiter">
            <Input
              value={config.delimiter ?? '\n\n'}
              onChange={(e) => handleStreamingFieldChange('delimiter', e.currentTarget.value)}
            />
          </Field>
          <Field label="Data prefix">
            <Input
              value={config.dataPrefix ?? 'data: '}
              onChange={(e) => handleStreamingFieldChange('dataPrefix', e.currentTarget.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
};
