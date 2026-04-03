import React from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions, AgentConfig } from 'types';
import { InlineChat } from './ui/chat/InlineChat';
import { FloatingChatPanel } from './ui/chat/FloatingChatPanel';
import { ChatProvider } from './ui/core/ChatConfig';
import { DEFAULT_PLACEHOLDER } from './ui/core/config';

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options }) => {
  const inlineMode = options.inlineMode ?? false;
  const placeholderText = options.placeholderText?.trim() || DEFAULT_PLACEHOLDER;
  const agents: AgentConfig[] = options.agents?.length ? options.agents : [];

  return (
    <ChatProvider
      debug={options.debug ?? false}
      agents={agents}
      placeholderText={placeholderText}
      suggestions={options.suggestions}
      suggestionsPlacement={options.suggestionsPlacement}
      showSuggestions={options.showSuggestions}
      maxWidth={options.maxWidth}
      centerInput={options.centerInput}
      welcomeMessage={options.welcomeMessage}
      showWelcomeMessage={options.showWelcomeMessage}
    >
      {inlineMode ? <InlineChat /> : <FloatingChatPanel />}
    </ChatProvider>
  );
};
