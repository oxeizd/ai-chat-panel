import React from 'react';
import { Switch, Field, Input, Combobox } from '@grafana/ui';
import { EndpointConfig, StreamingConfig } from 'types';

interface StreamingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const PARSE_STRATEGY_OPTIONS = [
  { label: 'SSE (Server-Sent Events)', value: 'sse' },
  { label: 'JSON Lines (jsonl)', value: 'jsonl' },
  { label: 'LangGraph (NDJSON events)', value: 'langgraph' },
];

function isStreamingEnabled(
  streaming: EndpointConfig['streaming']
): streaming is Extract<StreamingConfig, { enabled: true }> {
  return streaming !== null && typeof streaming === 'object' && streaming.enabled === true;
}

function getDefaultConfigForStrategy(strategy: 'sse' | 'jsonl' | 'langgraph'): StreamingConfig & { enabled: true } {
  if (strategy === 'sse') {
    return {
      enabled: true,
      parseStrategy: 'sse',
      textPath: 'choices[0].delta.content',
      delimiter: '\n\n',
      dataPrefix: 'data: ',
    };
  }
  if (strategy === 'jsonl') {
    return {
      enabled: true,
      parseStrategy: 'jsonl',
      textPath: 'choices[0].delta.content',
    };
  }
  return {
    enabled: true,
    parseStrategy: 'langgraph',
    textEventType: 'TEXT_MESSAGE_CONTENT',
    textDeltaField: 'delta',
  };
}

export const StreamingSection: React.FC<StreamingSectionProps> = ({ endpoint, onChange }) => {
  const streaming = endpoint.streaming;
  const enabled = isStreamingEnabled(streaming);
  const config = enabled ? streaming : null;

  const handleStreamingChange = (checked: boolean) => {
    if (checked) {
      onChange('streaming', getDefaultConfigForStrategy('sse'));
    } else {
      onChange('streaming', { enabled: false });
    }
  };

  const handleStreamingFieldChange = <K extends keyof Extract<StreamingConfig, { enabled: true }>>(
    field: K,
    val: any
  ) => {
    if (!enabled || !config) {
      const base = getDefaultConfigForStrategy('sse');
      onChange('streaming', { ...base, [field]: val });
      return;
    }
    onChange('streaming', { ...config, [field]: val });
  };

  const handleParseStrategyChange = (strategyValue: string) => {
    const strategy = strategyValue as 'sse' | 'jsonl' | 'langgraph';
    onChange('streaming', getDefaultConfigForStrategy(strategy));
  };

  const renderStrategyFields = () => {
    if (!config) {
      return null;
    }
    switch (config.parseStrategy) {
      case 'sse':
        return (
          <>
            <Field label="Text path (JSON path)">
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
          </>
        );
      case 'jsonl':
        return (
          <Field label="Text path (JSON path)">
            <Input
              value={config.textPath ?? 'choices[0].delta.content'}
              onChange={(e) => handleStreamingFieldChange('textPath', e.currentTarget.value)}
            />
          </Field>
        );
      case 'langgraph':
        return (
          <>
            <Field label="Text event type">
              <Input
                value={config.textEventType ?? 'TEXT_MESSAGE_CONTENT'}
                onChange={(e) => handleStreamingFieldChange('textEventType', e.currentTarget.value)}
              />
            </Field>
            <Field label="Text delta field">
              <Input
                value={config.textDeltaField ?? 'delta'}
                onChange={(e) => handleStreamingFieldChange('textDeltaField', e.currentTarget.value)}
              />
            </Field>
          </>
        );
      default:
        return null;
    }
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
              onChange={(opt) => handleParseStrategyChange(opt?.value)}
            />
          </Field>
          {renderStrategyFields()}
        </div>
      )}
    </div>
  );
};
