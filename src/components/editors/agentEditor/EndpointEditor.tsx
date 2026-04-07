import React, { useState } from 'react';
import { Button, Input, TextArea, Field, Combobox, Switch, useTheme2, Collapse } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, PollingConfig } from 'types';
import { methodOptions } from './constants';

const getEndpointEditorStyles = (theme: ReturnType<typeof useTheme2>) => ({
  container: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    margin-bottom: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding-right: ${theme.spacing(1)};
  `,
  content: css`
    padding: ${theme.spacing(1)};
    border-top: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
  `,
});

interface EndpointEditorProps {
  endpoint: EndpointConfig;
  index: number;
  onChange: (index: number, updated: EndpointConfig) => void;
  onRemove: (index: number) => void;
}

export const EndpointEditor: React.FC<EndpointEditorProps> = ({ endpoint, index, onChange, onRemove }) => {
  const theme = useTheme2();
  const styles = getEndpointEditorStyles(theme);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (field: keyof EndpointConfig, val: any) => {
    onChange(index, { ...endpoint, [field]: val });
  };

  const handleSaveToContextChange = (val: string) => {
    const fields = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    handleChange('saveToContext', fields);
  };

  const handlePollingChange = (enabled: boolean) => {
    const currentPolling = endpoint.polling || {};
    handleChange('polling', { ...currentPolling, enabled });
  };

  const handlePollingFieldChange = (field: keyof PollingConfig, val: any) => {
    const current = endpoint.polling || { enabled: false };
    handleChange('polling', { ...current, [field]: val });
  };

  const label = (
    <div className={styles.header}>
      <strong>
        Endpoint #{index + 1} {endpoint.operation ? `– ${endpoint.operation}` : ''}
      </strong>
      <Button
        variant="destructive"
        size="sm"
        icon="trash-alt"
        onClick={(e) => {
          e.stopPropagation(); // чтобы не разворачивать/сворачивать при клике на кнопку
          onRemove(index);
        }}
        aria-label="Delete endpoint"
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <Collapse label={label} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <div className={styles.content}>
          {/* Basic */}
          <div style={{ marginBottom: '16px' }}>
            <Field label="Operation name">
              <Input
                value={endpoint.operation}
                onChange={(e) => handleChange('operation', e.currentTarget.value)}
                placeholder="e.g.: ask, new_session, get_status"
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <Field label="HTTP method">
                <Combobox
                  value={methodOptions.find((opt) => opt.value === endpoint.method) || methodOptions[0]}
                  options={methodOptions}
                  onChange={(opt) => handleChange('method', opt?.value || 'POST')}
                />
              </Field>
              <Field label="Path (can contain variables)">
                <Input
                  value={endpoint.path}
                  onChange={(e) => handleChange('path', e.currentTarget.value)}
                  placeholder="/{thread}/messages"
                />
              </Field>
            </div>
          </div>

          {/* Headers */}
          <div style={{ marginBottom: '16px' }}>
            <Field label="Headers">
              <TextArea
                value={endpoint.headers || ''}
                onChange={(e) => handleChange('headers', e.currentTarget.value)}
                placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
                rows={2}
              />
            </Field>
          </div>

          {/* Request body */}
          <div style={{ marginBottom: '16px' }}>
            <Field label="Body">
              <TextArea
                value={endpoint.body || ''}
                onChange={(e) => handleChange('body', e.currentTarget.value)}
                placeholder='{"message": "{user_input}", "temperature": 0.7}'
                rows={3}
              />
            </Field>
            <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '4px' }}>
              Supports variables: {'{user_input}'}, {'{thread}'}, etc.
            </div>
          </div>

          {/* Response handling */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: theme.colors.text.secondary }}
            >
              Response handling
            </div>
            <Field label="Save fields to context">
              <Input
                value={endpoint.saveToContext?.join(', ') || ''}
                onChange={(e) => handleSaveToContextChange(e.currentTarget.value)}
                placeholder="thread, session_id, user_id"
              />
            </Field>
            <div
              style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px', marginBottom: '12px' }}
            >
              These fields will be available in subsequent requests
            </div>
            <Field label="Chat reply field">
              <Input
                value={endpoint.replyField || ''}
                onChange={(e) => handleChange('replyField', e.currentTarget.value)}
                placeholder="text, message, content"
              />
            </Field>
            <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px' }}>
              If not specified, it is detected automatically
            </div>
          </div>

          {/* Polling */}
          <div>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>
                ⏱ Result polling
              </div>
              <Switch
                value={endpoint.polling?.enabled || false}
                onChange={(e) => handlePollingChange(e.currentTarget.checked)}
              />
            </div>
            {endpoint.polling?.enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <Field label="Interval (ms)">
                  <Input
                    type="number"
                    value={endpoint.polling?.intervalMs ?? 1000}
                    onChange={(e) => handlePollingFieldChange('intervalMs', parseInt(e.currentTarget.value, 10))}
                  />
                </Field>
                <Field label="Max attempts">
                  <Input
                    type="number"
                    value={endpoint.polling?.maxAttempts ?? 10}
                    onChange={(e) => handlePollingFieldChange('maxAttempts', parseInt(e.currentTarget.value, 10))}
                  />
                </Field>
                <Field label="Status field">
                  <Input
                    value={endpoint.polling?.statusField ?? 'status'}
                    onChange={(e) => handlePollingFieldChange('statusField', e.currentTarget.value)}
                  />
                </Field>
                <Field label="Success value">
                  <Input
                    value={endpoint.polling?.successValue ?? 'completed'}
                    onChange={(e) => handlePollingFieldChange('successValue', e.currentTarget.value)}
                  />
                </Field>
                <Field label="Result field">
                  <Input
                    value={endpoint.polling?.resultField ?? 'result'}
                    onChange={(e) => handlePollingFieldChange('resultField', e.currentTarget.value)}
                  />
                </Field>
                <Field label="Retry HTTP statuses (optional)">
                  <Input
                    value={endpoint.polling?.retryStatusCodes?.join(', ') || ''}
                    onChange={(e) => {
                      const codes = e.currentTarget.value
                        .split(',')
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => !isNaN(n));
                      handlePollingFieldChange('retryStatusCodes', codes);
                    }}
                    placeholder="202, 404, 409"
                  />
                </Field>
                <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px' }}>
                  Receiving these HTTP statuses will continue polling (not treated as an error).
                </div>
              </div>
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
};
