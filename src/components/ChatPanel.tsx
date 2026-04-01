import React, { useState, useCallback } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions, AgentConfig } from 'types';
import { InlineChat } from './InlineChat';
import { FloatingChatPanel } from './FloatingChatPanel';
import { useChatMessages } from './hooks/useChatMessages';
import { useGrafanaUser } from './hooks/useGrafanaUser';
import { DEFAULT_PLACEHOLDER_TEXT } from './config';

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options }) => {
  const inlineMode = options.inlineMode ?? false;
  const placeholderText = options.placeholderText?.trim() || DEFAULT_PLACEHOLDER_TEXT;

  const { user } = useGrafanaUser();

  const agents = options.agents?.length
    ? options.agents
    : [
        {
          name: 'Агент по умолчанию',
          api: 'YOUR_AI_AGENT_API_ENDPOINT',
          config: '',
          default: true,
        },
      ];

  const defaultAgent = agents.find((a) => a.default) || agents[0];
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig>(defaultAgent);

  const { messages, isLoading, inputValue, setInputValue, sendMessage, clearChat, newChat } = useChatMessages(
    selectedAgent,
    user
  );

  const exportChat = useCallback(() => {
    const dataStr = JSON.stringify(messages, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_export.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const openSettings = useCallback(() => {
    console.log('Открыть настройки чата');
  }, []);

  // Преобразуем строку с запятыми в массив
  const suggestionsArray = options.suggestions
    ? options.suggestions.split(',').map(s => s.trim()).filter(Boolean)
    : [];

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
    maxWidth: options.maxWidth,
    centerInput: options.centerInput,
    welcomeMessage: options.welcomeMessage,
    showWelcomeMessage: options.showWelcomeMessage,
    suggestions: suggestionsArray,
    suggestionsPlacement: options.suggestionsPlacement || 'always',
  };

  if (inlineMode) {
    return <InlineChat {...commonProps} />;
  }

  return <FloatingChatPanel {...commonProps} />;
};