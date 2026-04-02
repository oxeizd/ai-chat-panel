// components/ChatPanel.tsx
import React, { useState, useCallback } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions, AgentConfig } from 'types';
import { InlineChat } from './ui/InlineChat';
import { FloatingChatPanel } from './ui/FloatingChatPanel';
import { useChatMessages } from './ui/hooks/useChatMessages';
import { useGrafanaUser } from './ui/hooks/useGrafanaUser';
import { DEFAULT_PLACEHOLDER_TEXT, DEFAULT_AGENT } from './ui/config';
import { ChatProvider, ChatConfig } from './ui/shared/ChatContext';

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options }) => {
  const inlineMode = options.inlineMode ?? false;
  const placeholderText = options.placeholderText?.trim() || DEFAULT_PLACEHOLDER_TEXT;

  const { user } = useGrafanaUser();

  const agents: AgentConfig[] = options.agents?.length ? options.agents : [DEFAULT_AGENT];

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

  const openSettings = useCallback(() => {}, []);

  const suggestionsArray = options.suggestions
    ? options.suggestions
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const chatConfig: ChatConfig = {
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
    suggestionsPlacement: options.suggestionsPlacement,
    showSuggestions: options.showSuggestions,
  };

  return <ChatProvider value={chatConfig}>{inlineMode ? <InlineChat /> : <FloatingChatPanel />}</ChatProvider>;
};
