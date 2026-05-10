import React from 'react';
import { Switch, Field, Input, useTheme2 } from '@grafana/ui';
import { EndpointConfig, ConversationHistoryConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface HistorySectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ endpoint, onChange }) => {
  const theme = useTheme2();

  const isHistoryEnabled = (): boolean => {
    if (!endpoint.conversationHistory) {
      return false;
    }
    if (typeof endpoint.conversationHistory === 'boolean') {
      return endpoint.conversationHistory;
    }
    return endpoint.conversationHistory.enabled === true;
  };

  const getHistoryConfig = (): ConversationHistoryConfig | null => {
    if (!endpoint.conversationHistory || typeof endpoint.conversationHistory === 'boolean') {
      return null;
    }
    return endpoint.conversationHistory;
  };

  const handleHistoryChange = (enabled: boolean) => {
    if (enabled) {
      if (!endpoint.conversationHistory || typeof endpoint.conversationHistory === 'boolean') {
        onChange('conversationHistory', {
          enabled: true,
          userMessageFields: ['role', 'content'],
          assistantMessageFields: ['role', 'replyText'],
        });
      } else {
        onChange('conversationHistory', { ...endpoint.conversationHistory, enabled: true });
      }
    } else {
      onChange('conversationHistory', false);
    }
  };

  const handleHistoryFieldChange = (field: keyof ConversationHistoryConfig, val: any) => {
    let current = endpoint.conversationHistory;
    if (!current || typeof current === 'boolean') {
      current = { enabled: true };
    }
    if (field === 'historySync') {
      onChange('conversationHistory', { ...current, historySync: val });
    } else {
      onChange('conversationHistory', { ...current, [field]: val });
    }
  };

  const config = getHistoryConfig();

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>
          💬 Conversation History
        </div>
        <Switch value={isHistoryEnabled()} onChange={(e) => handleHistoryChange(e.currentTarget.checked)} />
      </div>
      {isHistoryEnabled() && (
        <>
          <CommaSeparatedInput
            label="User message fields (comma‑separated)"
            value={config?.userMessageFields || []}
            onChange={(values) => handleHistoryFieldChange('userMessageFields', values)}
            placeholder="role, content"
          />
          <CommaSeparatedInput
            label="Assistant message fields (comma‑separated)"
            value={config?.assistantMessageFields || []}
            onChange={(values) => handleHistoryFieldChange('assistantMessageFields', values)}
            placeholder="role, replyText"
          />
          <Field label="History sync event type">
            <Input
              value={config?.historySync?.eventType || ''}
              onChange={(e) =>
                handleHistoryFieldChange('historySync', {
                  ...(config?.historySync || {}),
                  eventType: e.currentTarget.value,
                })
              }
              placeholder="MESSAGES_SNAPSHOT"
            />
          </Field>
          <Field label="Messages path in event">
            <Input
              value={config?.historySync?.messagesPath || ''}
              onChange={(e) =>
                handleHistoryFieldChange('historySync', {
                  ...(config?.historySync || {}),
                  messagesPath: e.currentTarget.value,
                })
              }
              placeholder="messages"
            />
          </Field>
        </>
      )}
    </div>
  );
};
