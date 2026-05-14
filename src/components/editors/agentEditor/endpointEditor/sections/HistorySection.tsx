import React, { useCallback } from 'react';
import { Switch, Field, Input, Combobox, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, ConversationHistoryConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface HistorySectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const MODE_OPTIONS = [
  { label: 'Manual (store from response)', value: 'manual' },
  { label: 'Snapshot (sync via events)', value: 'snapshot' },
];

const DEFAULT_MANUAL: ConversationHistoryConfig = {
  enabled: true,
  userMessageFields: ['role', 'content'],
  assistantMessageFields: [],
};

const DEFAULT_SNAPSHOT: ConversationHistoryConfig = {
  enabled: true,
  userMessageFields: [],
  assistantMessageFields: [],
  historySync: {
    eventType: 'MESSAGES_SNAPSHOT',
    messagesPath: 'messages',
  },
};

function normalizeConfig(raw: EndpointConfig['conversationHistory']): ConversationHistoryConfig | null {
  if (!raw) {
    return null;
  }

  if (raw === true) {
    return DEFAULT_MANUAL;
  }

  if (raw.enabled === false) {
    return null;
  }

  return raw;
}

function isManual(config: ConversationHistoryConfig | null): boolean {
  return !!config && !config.historySync?.eventType;
}

function isSnapshot(config: ConversationHistoryConfig | null): boolean {
  return !!config && !!config.historySync?.eventType;
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

export const HistorySection: React.FC<HistorySectionProps> = ({ endpoint, onChange }) => {
  const styles = useStyles2(getStyles);

  const rawConfig = endpoint.conversationHistory;
  const config = normalizeConfig(rawConfig);
  const enabled = config !== null;
  const currentMode = config?.historySync?.eventType ? 'snapshot' : 'manual';

  const handleToggle = useCallback(
    (checked: boolean) => {
      onChange('conversationHistory', checked ? DEFAULT_MANUAL : false);
    },
    [onChange]
  );

  const handleModeChange = useCallback(
    (mode: 'manual' | 'snapshot') => {
      onChange('conversationHistory', mode === 'manual' ? DEFAULT_MANUAL : DEFAULT_SNAPSHOT);
    },
    [onChange]
  );

  const handleManualFieldChange = (field: keyof ConversationHistoryConfig, val: any) => {
    const base = config && isManual(config) ? config : DEFAULT_MANUAL;
    onChange('conversationHistory', { ...base, [field]: val, historySync: undefined });
  };

  const handleSnapshotFieldChange = (field: 'eventType' | 'messagesPath', val: string) => {
    const base = config && isSnapshot(config) ? config : DEFAULT_SNAPSHOT;
    const newSync = { ...(base.historySync || { eventType: '', messagesPath: '' }), [field]: val };
    onChange('conversationHistory', { ...base, historySync: newSync });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>💬 Conversation History</div>
        <Switch value={enabled} onChange={(e) => handleToggle(e.currentTarget.checked)} />
      </div>

      {enabled && (
        <div className={styles.fields}>
          <Field label="Mode">
            <Combobox
              options={MODE_OPTIONS}
              value={currentMode}
              onChange={(opt) => handleModeChange(opt?.value as 'manual' | 'snapshot')}
            />
          </Field>

          {currentMode === 'manual' && (
            <>
              <CommaSeparatedInput
                label="User message fields"
                value={config?.userMessageFields || []}
                onChange={(values) => handleManualFieldChange('userMessageFields', values)}
                placeholder="role, content"
                description="Fields to extract from user message in request body"
              />
              <CommaSeparatedInput
                label="Assistant message fields"
                value={config?.assistantMessageFields || []}
                onChange={(values) => handleManualFieldChange('assistantMessageFields', values)}
                placeholder="role, content, id, threadId"
                description="Fields to extract from ai message in request body"
              />
            </>
          )}

          {currentMode === 'snapshot' && (
            <>
              <Field label="History sync event type">
                <Input
                  value={config?.historySync?.eventType || ''}
                  onChange={(e) => handleSnapshotFieldChange('eventType', e.currentTarget.value)}
                  placeholder="MESSAGES_SNAPSHOT"
                />
              </Field>
              <Field label="Messages path in event">
                <Input
                  value={config?.historySync?.messagesPath || ''}
                  onChange={(e) => handleSnapshotFieldChange('messagesPath', e.currentTarget.value)}
                  placeholder="messages"
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
};
