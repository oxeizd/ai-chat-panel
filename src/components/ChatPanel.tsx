import React, { useState } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions, AgentConfig } from 'types';
import { PanelDataErrorView } from '@grafana/runtime';
import { InlineChat } from './InlineChat';
import { FloatingChatPanel } from './FloatingChatPanel';
import { useChatMessages } from './hooks/useChatMessages';
import { DEFAULT_AGENT, DEFAULT_PLACEHOLDER_TEXT } from './ChatPanel.config';

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options, data, fieldConfig, id }) => {
  const inlineMode = options.inlineMode ?? false;
  const placeholderText = options.placeholderText?.trim() || DEFAULT_PLACEHOLDER_TEXT;

  const agents: AgentConfig[] = options.agents?.length ? options.agents : [DEFAULT_AGENT];

  const [selectedAgent, setSelectedAgent] = useState<AgentConfig>(agents[0]);

  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
  } = useChatMessages(selectedAgent);

  const exportChat = () => {
    const dataStr = JSON.stringify(messages, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSettings = () => console.log('Открыть настройки чата');

  if (data.series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsStringField
      />
    );
  }

  const commonProps = {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
    selectedAgent,
    setSelectedAgent,
    exportChat,
    openSettings,
    placeholderText,
    agents,
  };

  if (inlineMode) {
    return <InlineChat {...commonProps} />;
  }

  return <FloatingChatPanel {...commonProps} />;
};