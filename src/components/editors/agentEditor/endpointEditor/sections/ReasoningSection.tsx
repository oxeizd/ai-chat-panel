import React, { useCallback } from 'react';
import { Switch, Field, Input, Combobox, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, ReasoningConfig } from 'types';

interface ReasoningSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const TYPE_OPTIONS = [
  { label: 'Embedded (in API fields or thinking tags)', value: 'embedded' },
  { label: 'Separate (thinking events)', value: 'separate' },
];

const MODE_OPTIONS = [
  { label: 'API field only', value: 'api_field' },
  { label: 'Thinking tags only', value: 'thinking_tags' },
];

const DEFAULT_EMBEDDED_API: ReasoningConfig = {
  enabled: true,
  type: 'embedded',
  mode: 'api_field',
  apiField: 'choices[0].delta.reasoning',
};

const DEFAULT_EMBEDDED_TAGS: ReasoningConfig = {
  enabled: true,
  type: 'embedded',
  mode: 'thinking_tags',
  textPath: 'choices[0].message.content',
  startMarker: '<thinking>',
  endMarker: '</thinking>',
};

const DEFAULT_SEPARATE: ReasoningConfig = {
  enabled: true,
  type: 'separate',
  eventType: 'THINKING_START',
  contentField: 'THINKING_TEXT_MESSAGE_CONTENT',
  resultField: 'THINKING_END',
};

// Type guards
function isReasoningEnabled(config: ReasoningConfig): config is Extract<ReasoningConfig, { enabled: true }> {
  return config !== null && config.enabled === true;
}

function isEmbedded(config: ReasoningConfig): config is Extract<ReasoningConfig, { enabled: true; type: 'embedded' }> {
  return isReasoningEnabled(config) && config.type === 'embedded';
}

function isSeparate(config: ReasoningConfig): config is Extract<ReasoningConfig, { enabled: true; type: 'separate' }> {
  return isReasoningEnabled(config) && config.type === 'separate';
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
  const reasoning: ReasoningConfig = endpoint.reasoning ?? { enabled: false };
  const enabled = isReasoningEnabled(reasoning);
  const currentType = enabled ? reasoning.type : 'embedded';

  const handleToggle = useCallback(
    (checked: boolean) => {
      onChange('reasoning', checked ? DEFAULT_EMBEDDED_API : { enabled: false });
    },
    [onChange]
  );

  const handleTypeChange = useCallback(
    (type: 'embedded' | 'separate') => {
      onChange('reasoning', type === 'embedded' ? DEFAULT_EMBEDDED_API : DEFAULT_SEPARATE);
    },
    [onChange]
  );

  const handleModeChange = useCallback(
    (mode: 'api_field' | 'thinking_tags') => {
      if (!enabled) {
        return;
      }
      const newConfig: ReasoningConfig = mode === 'api_field' ? DEFAULT_EMBEDDED_API : DEFAULT_EMBEDDED_TAGS;
      onChange('reasoning', newConfig);
    },
    [enabled, onChange]
  );

  const handleEmbeddedFieldChange = <K extends keyof Extract<ReasoningConfig, { type: 'embedded' }>>(
    field: K,
    value: any
  ) => {
    if (!isEmbedded(reasoning)) {
      return;
    }
    onChange('reasoning', { ...reasoning, [field]: value });
  };

  const handleSeparateFieldChange = <K extends keyof Extract<ReasoningConfig, { type: 'separate' }>>(
    field: K,
    value: any
  ) => {
    if (!isSeparate(reasoning)) {
      return;
    }
    onChange('reasoning', { ...reasoning, [field]: value });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>🤔 Reasoning / Thinking</div>
        <Switch value={enabled} onChange={(e) => handleToggle(e.currentTarget.checked)} />
      </div>

      {enabled && (
        <div className={styles.fields}>
          <Field label="Type">
            <Combobox
              options={TYPE_OPTIONS}
              value={currentType}
              onChange={(opt) => handleTypeChange(opt?.value as 'embedded' | 'separate')}
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
              <Field label="Event type">
                <Input
                  value={reasoning.eventType ?? DEFAULT_SEPARATE.eventType}
                  onChange={(e) => handleSeparateFieldChange('eventType', e.currentTarget.value)}
                  placeholder="THINKING"
                />
              </Field>
              <Field label="Content field">
                <Input
                  value={reasoning.contentField ?? DEFAULT_SEPARATE.contentField}
                  onChange={(e) => handleSeparateFieldChange('contentField', e.currentTarget.value)}
                  placeholder="delta"
                />
              </Field>
              <Field label="Result field (optional, for end marker)">
                <Input
                  value={reasoning.resultField ?? ''}
                  onChange={(e) => handleSeparateFieldChange('resultField', e.currentTarget.value)}
                  placeholder="status"
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
};
