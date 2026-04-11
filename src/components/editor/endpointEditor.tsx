import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button, Input, TextArea, Field, Combobox, Switch, useTheme2, Collapse } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, PollingConfig, StreamingConfig } from 'types';
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
  `,
  content: css`
    padding: ${theme.spacing(1)};
    border-top: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
  `,
});

export interface EndpointEditorHandle {
  getCurrentValue: () => { body: Record<string, any>; headers: Record<string, string> };
}

interface EndpointEditorProps {
  endpoint: EndpointConfig;
  index: number;
  onChange: (index: number, updated: EndpointConfig) => void;
  onRemove: (index: number) => void;
}

export const EndpointEditor = forwardRef<EndpointEditorHandle, EndpointEditorProps>(function EndpointEditor(
  { endpoint, index, onChange, onRemove },
  ref
) {
  const theme = useTheme2();
  const styles = getEndpointEditorStyles(theme);
  const [isOpen, setIsOpen] = useState(false);

  const [bodyStr, setBodyStr] = useState('');
  const [headersStr, setHeadersStr] = useState('');
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [saveToContextRaw, setSaveToContextRaw] = useState(endpoint.saveToContext?.join(', ') || '');

  // Локальные состояния для comma-separated полей (исправление бага с запятыми)
  const [userMessageFieldsRaw, setUserMessageFieldsRaw] = useState(endpoint.userMessageFields?.join(', ') || '');
  const [assistantMessageFieldsRaw, setAssistantMessageFieldsRaw] = useState(
    endpoint.assistantMessageFields?.join(', ') || ''
  );
  const [retryStatusCodesRaw, setRetryStatusCodesRaw] = useState(endpoint.polling?.retryStatusCodes?.join(', ') || '');

  const lastValidBodyRef = useRef<Record<string, any>>(endpoint.body || {});
  const lastValidHeadersRef = useRef<Record<string, string>>(endpoint.headers || {});

  // Синхронизация локальных строк с пропсами при внешнем изменении
  useEffect(() => {
    setSaveToContextRaw(endpoint.saveToContext?.join(', ') || '');
  }, [endpoint.saveToContext]);

  useEffect(() => {
    setUserMessageFieldsRaw(endpoint.userMessageFields?.join(', ') || '');
  }, [endpoint.userMessageFields]);

  useEffect(() => {
    setAssistantMessageFieldsRaw(endpoint.assistantMessageFields?.join(', ') || '');
  }, [endpoint.assistantMessageFields]);

  useEffect(() => {
    setRetryStatusCodesRaw(endpoint.polling?.retryStatusCodes?.join(', ') || '');
  }, [endpoint.polling?.retryStatusCodes]);

  useEffect(() => {
    setBodyStr(endpoint.body ? JSON.stringify(endpoint.body, null, 2) : '');
    lastValidBodyRef.current = endpoint.body || {};
    setBodyError(null);
  }, [endpoint.body]);

  useEffect(() => {
    setHeadersStr(endpoint.headers ? JSON.stringify(endpoint.headers, null, 2) : '');
    lastValidHeadersRef.current = endpoint.headers || {};
    setHeadersError(null);
  }, [endpoint.headers]);

  useImperativeHandle(ref, () => ({
    getCurrentValue: () => ({
      body: bodyError ? {} : (lastValidBodyRef.current ?? {}),
      headers: headersError ? {} : (lastValidHeadersRef.current ?? {}),
    }),
  }));

  const handleChange = (field: keyof EndpointConfig, val: any) => {
    onChange(index, { ...endpoint, [field]: val });
  };

  // Body
  const handleBodyChange = (value: string) => {
    setBodyStr(value);
    if (value.trim() === '') {
      setBodyError(null);
      return;
    }
    try {
      JSON.parse(value);
      setBodyError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setBodyError(errorMessage);
    }
  };

  const handleBodyBlur = () => {
    const value = bodyStr.trim();
    if (value === '') {
      setBodyError(null);
      lastValidBodyRef.current = {};
      handleChange('body', {});
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Body must be a JSON object');
      }
      setBodyError(null);
      lastValidBodyRef.current = parsed;
      handleChange('body', parsed);
    } catch (err) {
      // ошибка уже показана
    }
  };

  // Headers
  const handleHeadersChange = (value: string) => {
    setHeadersStr(value);
    if (value.trim() === '') {
      setHeadersError(null);
      return;
    }
    try {
      JSON.parse(value);
      setHeadersError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setHeadersError(errorMessage);
    }
  };

  const handleHeadersBlur = () => {
    const value = headersStr.trim();
    if (value === '') {
      setHeadersError(null);
      lastValidHeadersRef.current = {};
      handleChange('headers', {});
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Headers must be a JSON object');
      }
      setHeadersError(null);
      lastValidHeadersRef.current = parsed;
      handleChange('headers', parsed);
    } catch (err) {
      // ошибка уже показана
    }
  };

  // Save to context (уже был onBlur, но добавили синхронизацию)
  const handleSaveToContextBlur = () => {
    const fields = saveToContextRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    handleChange('saveToContext', fields);
  };

  // User message fields (исправлено: onBlur + локальное состояние)
  const handleUserMessageFieldsBlur = () => {
    const fields = userMessageFieldsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    handleChange('userMessageFields', fields);
  };

  // Assistant message fields (исправлено)
  const handleAssistantMessageFieldsBlur = () => {
    const fields = assistantMessageFieldsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    handleChange('assistantMessageFields', fields);
  };

  // Polling
  const handlePollingChange = (enabled: boolean) => {
    const currentPolling = endpoint.polling || {};
    handleChange('polling', { ...currentPolling, enabled });
  };

  const handlePollingFieldChange = (field: keyof PollingConfig, val: any) => {
    const current = endpoint.polling || { enabled: false };
    handleChange('polling', { ...current, [field]: val });
  };

  // Retry status codes (исправлено: onBlur + локальное состояние)
  const handleRetryStatusCodesBlur = () => {
    const codes = retryStatusCodesRaw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    handlePollingFieldChange('retryStatusCodes', codes);
  };

  // Streaming
  const handleStreamingChange = (enabled: boolean) => {
    if (enabled) {
      if (!endpoint.streaming || typeof endpoint.streaming === 'boolean') {
        handleChange('streaming', {
          enabled: true,
          textPath: 'choices[0].delta.content',
          delimiter: '\n\n',
          dataPrefix: 'data: ',
        });
      } else {
        handleChange('streaming', { ...endpoint.streaming, enabled: true });
      }
    } else {
      handleChange('streaming', false);
    }
  };

  const handleStreamingFieldChange = (field: keyof StreamingConfig, val: any) => {
    let current = endpoint.streaming;
    if (!current || typeof current === 'boolean') {
      current = { enabled: true };
    }
    handleChange('streaming', { ...current, [field]: val });
  };

  const isStreamingEnabled = () => {
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

  // History sync (исправлено: не перезаписываем друг друга значениями по умолчанию)
  const handleHistorySyncEventTypeChange = (eventType: string) => {
    const current = endpoint.historySync || {};
    handleChange('historySync', { ...current, eventType });
  };

  const handleHistorySyncMessagesPathChange = (messagesPath: string) => {
    const current = endpoint.historySync || {};
    handleChange('historySync', { ...current, messagesPath });
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
          e.stopPropagation();
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
                placeholder="e.g.: ask"
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
            <Field label="Headers (JSON object)" invalid={!!headersError} error={headersError}>
              <TextArea
                value={headersStr}
                onChange={(e) => handleHeadersChange(e.currentTarget.value)}
                onBlur={handleHeadersBlur}
                placeholder='{"Authorization": "Bearer token"}'
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </Field>
          </div>

          {/* Request body */}
          <div style={{ marginBottom: '16px' }}>
            <Field label="Body" invalid={!!bodyError} error={bodyError}>
              <TextArea
                value={bodyStr}
                onChange={(e) => handleBodyChange(e.currentTarget.value)}
                onBlur={handleBodyBlur}
                placeholder='{"message": "{user_input}", "temperature": 0.7}'
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </Field>
            <div style={{ fontSize: '11px', color: theme.colors.text.disabled }}>
              Use {'{variable}'} for substitution from context.
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
                value={saveToContextRaw}
                onChange={(e) => setSaveToContextRaw(e.currentTarget.value)}
                onBlur={handleSaveToContextBlur}
                placeholder="thread_id, run_id, user_id"
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
                <Field label="Retry HTTP statuses">
                  <Input
                    value={retryStatusCodesRaw}
                    onChange={(e) => setRetryStatusCodesRaw(e.currentTarget.value)}
                    onBlur={handleRetryStatusCodesBlur}
                    placeholder="202, 404, 409"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Streaming */}
          <div style={{ marginTop: '16px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}
            >
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

          {/* Conversation History */}
          <div style={{ marginTop: '16px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>
                💬 Conversation History
              </div>
              <Switch
                value={endpoint.preserveConversationHistory || false}
                onChange={(e) => handleChange('preserveConversationHistory', e.currentTarget.checked)}
              />
            </div>
            {endpoint.preserveConversationHistory && (
              <>
                <Field label="User message fields (comma‑separated)">
                  <Input
                    value={userMessageFieldsRaw}
                    onChange={(e) => setUserMessageFieldsRaw(e.currentTarget.value)}
                    onBlur={handleUserMessageFieldsBlur}
                    placeholder="id, sessionID"
                  />
                </Field>
                <Field label="Assistant message fields (comma‑separated)">
                  <Input
                    value={assistantMessageFieldsRaw}
                    onChange={(e) => setAssistantMessageFieldsRaw(e.currentTarget.value)}
                    onBlur={handleAssistantMessageFieldsBlur}
                    placeholder="id, reasoning_details, tool_calls"
                  />
                </Field>
              </>
            )}

            {endpoint.preserveConversationHistory && (
              <>
                <Field label="History sync event type">
                  <Input
                    value={endpoint.historySync?.eventType || ''}
                    onChange={(e) => handleHistorySyncEventTypeChange(e.currentTarget.value)}
                    placeholder="MESSAGES_SNAPSHOT"
                  />
                </Field>
                <Field label="Messages path in event">
                  <Input
                    value={endpoint.historySync?.messagesPath || ''}
                    onChange={(e) => handleHistorySyncMessagesPathChange(e.currentTarget.value)}
                    placeholder="messages"
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
});
