import React from 'react';
import { Switch, Field, Input, Combobox, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, StreamingConfig } from 'types';

interface StreamingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const PARSE_STRATEGY_OPTIONS = [
  { label: 'SSE (Server-Sent Events)', value: 'sse' },
  { label: 'JSON Lines (jsonl)', value: 'jsonl' },
];

const EXTRACTION_MODE_OPTIONS = [
  { label: 'JSON path (dot notation)', value: 'jsonpath' },
  { label: 'Event type + field', value: 'eventfield' },
];

function getDefaultConfig(strategy: 'sse' | 'jsonl'): StreamingConfig & { enabled: true } {
  if (strategy === 'sse') {
    return {
      enabled: true,
      parseStrategy: 'sse',
      textPath: 'choices[0].delta.content',
      delimiter: '\\n\\n',
      dataPrefix: 'data: ',
    };
  }
  return {
    enabled: true,
    parseStrategy: 'jsonl',
    textPath: 'choices[0].delta.content',
  };
}

const getStyles = () => ({
  container: css`
    margin-top: 16px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `,
  fields: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  `,
});

export const StreamingSection: React.FC<StreamingSectionProps> = ({ endpoint, onChange }) => {
  const styles = useStyles2(getStyles);
  const streaming = endpoint.streaming;
  const enabled = streaming?.enabled === true;
  const config = enabled ? streaming : null;

  const handleEnable = (checked: boolean) => {
    if (checked) {
      onChange('streaming', getDefaultConfig('sse'));
    } else {
      onChange('streaming', { enabled: false });
    }
  };

  const handleStrategyChange = (strategyValue: string) => {
    onChange('streaming', getDefaultConfig(strategyValue as any));
  };

  const handleFieldChange = <K extends keyof Extract<StreamingConfig, { enabled: true }>>(field: K, value: any) => {
    if (!config) {
      return;
    }
    onChange('streaming', { ...config, [field]: value });
  };

  const extractionMode = config?.textEventType ? 'eventfield' : 'jsonpath';

  const handleExtractionModeChange = (mode: string) => {
    if (!config || config.parseStrategy !== 'sse') {
      return;
    }
    if (mode === 'jsonpath') {
      const { textEventType, textDeltaField, ...rest } = config;
      onChange('streaming', { ...rest, textPath: config.textPath ?? 'choices[0].delta.content' });
    } else {
      const { textPath, ...rest } = config;
      onChange('streaming', {
        ...rest,
        textEventType: config.textEventType ?? 'TEXT_MESSAGE_CONTENT',
        textDeltaField: config.textDeltaField ?? 'delta',
      });
    }
  };

  const renderSseFields = () => {
    if (!config) {
      return null;
    }
    return (
      <>
        <Field label="Extraction mode">
          <Combobox
            options={EXTRACTION_MODE_OPTIONS}
            value={extractionMode}
            onChange={(opt) => handleExtractionModeChange(opt?.value)}
          />
        </Field>
        {extractionMode === 'jsonpath' ? (
          <Field label="JSON path (dot notation)" description="e.g., choices[0].delta.content">
            <Input
              value={config.textPath ?? 'choices[0].delta.content'}
              onChange={(e) => handleFieldChange('textPath', e.currentTarget.value)}
            />
          </Field>
        ) : (
          <>
            <Field label="Event type" description="Type field value to filter (e.g., TEXT_MESSAGE_CONTENT)">
              <Input
                value={config.textEventType ?? 'TEXT_MESSAGE_CONTENT'}
                onChange={(e) => handleFieldChange('textEventType', e.currentTarget.value)}
              />
            </Field>
            <Field label="Delta field" description="Field containing the text chunk (e.g., delta)">
              <Input
                value={config.textDeltaField ?? 'delta'}
                onChange={(e) => handleFieldChange('textDeltaField', e.currentTarget.value)}
              />
            </Field>
          </>
        )}
        <Field label="Delimiter">
          <Input
            value={config.delimiter ?? '\\n\\n'}
            onChange={(e) => handleFieldChange('delimiter', e.currentTarget.value)}
          />
        </Field>
        <Field label="Data prefix">
          <Input
            value={config.dataPrefix ?? 'data: '}
            onChange={(e) => handleFieldChange('dataPrefix', e.currentTarget.value)}
          />
        </Field>
      </>
    );
  };

  const renderJsonlFields = () => {
    if (!config) {
      return null;
    }
    return (
      <Field label="JSON path (dot notation)" description="e.g., choices[0].delta.content">
        <Input
          value={config.textPath ?? 'choices[0].delta.content'}
          onChange={(e) => handleFieldChange('textPath', e.currentTarget.value)}
        />
      </Field>
    );
  };

  const renderStrategyFields = () => {
    if (!config) {
      return null;
    }
    switch (config.parseStrategy) {
      case 'sse':
        return renderSseFields();
      case 'jsonl':
        return renderJsonlFields();
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>📡 Streaming</div>
        <Switch value={enabled} onChange={(e) => handleEnable(e.currentTarget.checked)} />
      </div>
      {enabled && config && (
        <div className={styles.fields}>
          <Field label="Parse strategy">
            <Combobox
              options={PARSE_STRATEGY_OPTIONS}
              value={config.parseStrategy}
              onChange={(opt) => handleStrategyChange(opt?.value)}
            />
          </Field>
          {renderStrategyFields()}
        </div>
      )}
    </div>
  );
};
