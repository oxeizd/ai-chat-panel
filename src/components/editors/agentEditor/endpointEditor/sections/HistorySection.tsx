import React, { useCallback } from 'react';
import { Switch, Field, Input, Combobox, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, ChatHistoryConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface HistorySectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const MODE_OPTIONS = [
  { label: 'Local (store from response)', value: 'local' },
  { label: 'Incoming sync (via events)', value: 'incoming_sync' },
];

const DEFAULT_LOCAL: ChatHistoryConfig = {
  enabled: true,
  mode: 'local',
  userMessageFields: ['role', 'content'],
  assistantMessageFields: [],
  maxMessages: 100,
};

const DEFAULT_SYNC: ChatHistoryConfig = {
  enabled: true,
  mode: 'incoming_sync',
  historySync: {
    eventType: 'MESSAGES_SNAPSHOT',
    messagesPath: 'messages',
  },
};

// Type guards
function isHistoryEnabled(config: ChatHistoryConfig): config is Extract<ChatHistoryConfig, { enabled: true }> {
  return config !== null && config.enabled === true;
}

function isLocal(config: ChatHistoryConfig): config is Extract<ChatHistoryConfig, { mode: 'local' }> {
  return isHistoryEnabled(config) && config.mode === 'local';
}

function isSync(config: ChatHistoryConfig): config is Extract<ChatHistoryConfig, { mode: 'incoming_sync' }> {
  return isHistoryEnabled(config) && config.mode === 'incoming_sync';
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
  const rawConfig = endpoint.historyConfig ?? { enabled: false };
  const enabled = isHistoryEnabled(rawConfig);
  const currentMode = enabled && rawConfig.mode === 'incoming_sync' ? 'incoming_sync' : 'local';

  const handleToggle = useCallback(
    (checked: boolean) => {
      onChange('historyConfig', checked ? DEFAULT_LOCAL : { enabled: false });
    },
    [onChange]
  );

  const handleModeChange = useCallback(
    (mode: 'local' | 'incoming_sync') => {
      onChange('historyConfig', mode === 'local' ? DEFAULT_LOCAL : DEFAULT_SYNC);
    },
    [onChange]
  );

  const handleLocalFieldChange = (
    field: keyof Omit<Extract<ChatHistoryConfig, { mode: 'local' }>, 'enabled' | 'mode'>,
    val: any
  ) => {
    let base: Extract<ChatHistoryConfig, { mode: 'local' }>;
    if (isLocal(rawConfig)) {
      base = rawConfig;
    } else {
      base = DEFAULT_LOCAL;
    }
    onChange('historyConfig', { ...base, [field]: val });
  };

  const handleSyncFieldChange = (
    field: keyof Extract<ChatHistoryConfig, { mode: 'incoming_sync' }>['historySync'],
    val: string
  ) => {
    if (!isSync(rawConfig)) {
      // Если текущий конфиг не синк, создаём новый на основе DEFAULT_SYNC
      const newSync = { ...DEFAULT_SYNC.historySync, [field]: val };
      onChange('historyConfig', { ...DEFAULT_SYNC, historySync: newSync });
      return;
    }
    const newSync = { ...rawConfig.historySync, [field]: val };
    onChange('historyConfig', { ...rawConfig, historySync: newSync });
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
              onChange={(opt) => handleModeChange(opt?.value as 'local' | 'incoming_sync')}
            />
          </Field>

          {currentMode === 'local' && isLocal(rawConfig) && (
            <>
              <CommaSeparatedInput
                label="User message fields"
                value={rawConfig.userMessageFields || []}
                onChange={(values) => handleLocalFieldChange('userMessageFields', values)}
                placeholder="role, content"
              />
              <CommaSeparatedInput
                label="Assistant message fields"
                value={rawConfig.assistantMessageFields || []}
                onChange={(values) => handleLocalFieldChange('assistantMessageFields', values)}
                placeholder="role, content, id"
              />
              <Field label="Max messages">
                <Input
                  type="number"
                  value={rawConfig.maxMessages ?? 100}
                  onChange={(e) => handleLocalFieldChange('maxMessages', parseInt(e.currentTarget.value, 10))}
                />
              </Field>
            </>
          )}

          {currentMode === 'incoming_sync' && isSync(rawConfig) && (
            <>
              <Field label="History sync event type">
                <Input
                  value={rawConfig.historySync.eventType}
                  onChange={(e) => handleSyncFieldChange('eventType', e.currentTarget.value)}
                  placeholder="MESSAGES_SNAPSHOT"
                />
              </Field>
              <Field label="Messages path in event">
                <Input
                  value={rawConfig.historySync.messagesPath}
                  onChange={(e) => handleSyncFieldChange('messagesPath', e.currentTarget.value)}
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
