import React from 'react';
import { Switch, Field, Input, useTheme2 } from '@grafana/ui';
import { EndpointConfig } from 'types';
import { CommaSeparatedInput } from 'components/editors/shared/CommaSeparatedInput';

interface HistorySectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({ endpoint, onChange }) => {
  const theme = useTheme2();

  const handleHistoryChange = (enabled: boolean) => {
    onChange('preserveConversationHistory', enabled);
  };

  const handleHistorySyncEventTypeChange = (eventType: string) => {
    const current = endpoint.historySync || {};
    onChange('historySync', { ...current, eventType });
  };

  const handleHistorySyncMessagesPathChange = (messagesPath: string) => {
    const current = endpoint.historySync || {};
    onChange('historySync', { ...current, messagesPath });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>
          💬 Conversation History
        </div>
        <Switch
          value={endpoint.preserveConversationHistory || false}
          onChange={(e) => handleHistoryChange(e.currentTarget.checked)}
        />
      </div>
      {endpoint.preserveConversationHistory && (
        <>
          <CommaSeparatedInput
            label="User message fields (comma‑separated)"
            value={endpoint.userMessageFields || []}
            onChange={(values) => onChange('userMessageFields', values)}
            placeholder="id, sessionID"
          />
          <CommaSeparatedInput
            label="Assistant message fields (comma‑separated)"
            value={endpoint.assistantMessageFields || []}
            onChange={(values) => onChange('assistantMessageFields', values)}
            placeholder="id, reasoning_details, tool_calls"
          />
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
  );
};
