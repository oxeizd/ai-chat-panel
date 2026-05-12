import React, { useCallback } from 'react';
import { Switch, Field, Input, Combobox, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, EmbeddedReasoning, SeparateReasoning, ReasoningConfig } from 'types';

interface ReasoningSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const MODE_OPTIONS = [
  { label: 'API field only', value: 'api_field' },
  { label: 'Thinking tags only', value: 'thinking_tags' },
];

const FORMAT_OPTIONS = [
  { label: 'Embedded (in API fields or tags)', value: 'embedded' },
  { label: 'Separate (thinking events)', value: 'separate' },
];

// Дефолтные конфигурации
const DEFAULT_EMBEDDED_API: EmbeddedReasoning = {
  enabled: true,
  format: 'embedded',
  mode: 'api_field',
  apiField: 'choices[0].delta.reasoning_content',
};

const DEFAULT_EMBEDDED_TAGS: EmbeddedReasoning = {
  enabled: true,
  format: 'embedded',
  mode: 'thinking_tags',
  textPath: 'choices[0].delta.content',
  startMarker: '<thinking>',
  endMarker: '</thinking>',
};

const DEFAULT_SEPARATE: SeparateReasoning = {
  enabled: true,
  format: 'separate',
  eventMapping: {
    thinkingStart: 'THINKING_START',
    thinkingContent: 'THINKING_TEXT_MESSAGE_CONTENT',
    thinkingEnd: 'THINKING_END',
  },
};

// Type guards
function isEmbedded(config: ReasoningConfig): config is EmbeddedReasoning {
  return config !== false && config.format === 'embedded';
}

function isSeparate(config: ReasoningConfig): config is SeparateReasoning {
  return config !== false && config.format === 'separate';
}

const getStyles = () => ({
  container: css`
    margin-top: 16px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  `,
  fields: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  `,
});

export const ReasoningSection: React.FC<ReasoningSectionProps> = ({ endpoint, onChange }) => {
  const styles = useStyles2(getStyles);
  const reasoning: ReasoningConfig = endpoint.reasoning ?? false;
  const enabled = reasoning !== false;
  const currentFormat = enabled && 'format' in reasoning ? reasoning.format : 'embedded';

  const handleToggle = useCallback(
    (checked: boolean) => {
      onChange('reasoning', checked ? DEFAULT_EMBEDDED_API : false);
    },
    [onChange]
  );

  const handleFormatChange = useCallback(
    (format: 'embedded' | 'separate') => {
      onChange('reasoning', format === 'embedded' ? DEFAULT_EMBEDDED_API : DEFAULT_SEPARATE);
    },
    [onChange]
  );

  const handleModeChange = useCallback(
    (mode: 'api_field' | 'thinking_tags') => {
      if (!enabled) {
        return;
      }
      const newConfig: EmbeddedReasoning =
        mode === 'api_field'
          ? { ...DEFAULT_EMBEDDED_API, mode: 'api_field' }
          : { ...DEFAULT_EMBEDDED_TAGS, mode: 'thinking_tags' };
      onChange('reasoning', newConfig);
    },
    [enabled, onChange]
  );

  const handleEmbeddedFieldChange = useCallback(
    <K extends keyof EmbeddedReasoning>(field: K, value: EmbeddedReasoning[K]) => {
      if (!isEmbedded(reasoning)) {
        return;
      }
      onChange('reasoning', { ...reasoning, [field]: value });
    },
    [reasoning, onChange]
  );

  const handleSeparateChange = useCallback(
    <K extends keyof SeparateReasoning>(field: K, value: SeparateReasoning[K]) => {
      if (!isSeparate(reasoning)) {
        return;
      }
      onChange('reasoning', { ...reasoning, [field]: value });
    },
    [reasoning, onChange]
  );

  const handleMappingChange = (key: keyof NonNullable<SeparateReasoning['eventMapping']>, val: string) => {
    if (!isSeparate(reasoning)) {
      return;
    }
    const current = reasoning.eventMapping ?? {};
    handleSeparateChange('eventMapping', { ...current, [key]: val });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>🤔 Reasoning / Thinking</div>
        <Switch value={enabled} onChange={(e) => handleToggle(e.currentTarget.checked)} />
      </div>

      {enabled && (
        <div className={styles.fields}>
          <Field label="Format">
            <Combobox
              options={FORMAT_OPTIONS}
              value={currentFormat}
              onChange={(opt) => handleFormatChange(opt?.value as 'embedded' | 'separate')}
            />
          </Field>

          {isEmbedded(reasoning) && (
            <>
              <Field label="Extraction mode">
                <Combobox
                  options={MODE_OPTIONS}
                  value={reasoning.mode}
                  onChange={(opt) => handleModeChange(opt?.value as 'api_field' | 'thinking_tags')}
                />
              </Field>

              {reasoning.mode === 'api_field' && (
                <Field label="API field path">
                  <Input
                    value={reasoning.apiField ?? DEFAULT_EMBEDDED_API.apiField}
                    onChange={(e) => handleEmbeddedFieldChange('apiField', e.currentTarget.value)}
                  />
                </Field>
              )}

              {reasoning.mode === 'thinking_tags' && (
                <>
                  <Field label="Text path for tags">
                    <Input
                      value={reasoning.textPath ?? DEFAULT_EMBEDDED_TAGS.textPath}
                      onChange={(e) => handleEmbeddedFieldChange('textPath', e.currentTarget.value)}
                    />
                  </Field>
                  <Field label="Start marker">
                    <Input
                      value={reasoning.startMarker ?? DEFAULT_EMBEDDED_TAGS.startMarker}
                      onChange={(e) => handleEmbeddedFieldChange('startMarker', e.currentTarget.value)}
                    />
                  </Field>
                  <Field label="End marker">
                    <Input
                      value={reasoning.endMarker ?? DEFAULT_EMBEDDED_TAGS.endMarker}
                      onChange={(e) => handleEmbeddedFieldChange('endMarker', e.currentTarget.value)}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {isSeparate(reasoning) && (
            <>
              <Field label="Thinking start event" description="Default: THINKING_START">
                <Input
                  value={reasoning.eventMapping?.thinkingStart ?? 'THINKING_START'}
                  onChange={(e) => handleMappingChange('thinkingStart', e.currentTarget.value)}
                />
              </Field>
              <Field label="Thinking content event" description="Default: THINKING_TEXT_MESSAGE_CONTENT">
                <Input
                  value={reasoning.eventMapping?.thinkingContent ?? 'THINKING_TEXT_MESSAGE_CONTENT'}
                  onChange={(e) => handleMappingChange('thinkingContent', e.currentTarget.value)}
                />
              </Field>
              <Field label="Thinking end event" description="Default: THINKING_END">
                <Input
                  value={reasoning.eventMapping?.thinkingEnd ?? 'THINKING_END'}
                  onChange={(e) => handleMappingChange('thinkingEnd', e.currentTarget.value)}
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
};
