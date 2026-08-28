import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';

import { PanelOptions } from 'types';
import { ChatProvider } from './ui/chat/ChatProvider';
import { ButtonChatPanel } from './ui/chatPanel/ButtonChatPanel';
import { FloatingChatPanel } from './ui/chatPanel/FloatingChatPanel';
import { InlineChat } from './ui/chatPanel/InlineChat';
import { ChatHistoryModalHost } from './ui/chatPanel/ChatHistoryModal';

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options }) => {
  const renderChat = useMemo(() => {
    switch (options.chatMode) {
      case 'inline':
        return <InlineChat />;
      case 'button':
        return <ButtonChatPanel />;
      default:
        return <FloatingChatPanel />;
    }
  }, [options.chatMode]);

  const providerProps = useMemo(
    () => ({
      agents: options.agents,
      placeholderText: options.settings.placeholderText,
      suggestions: options.settings.suggestions,
      suggestionsPlacement: options.settings.suggestionsPlacement,
      showSuggestions: options.settings.showSuggestions,
      suggestionsAppendToAll: options.settings.suggestionsAppendToAll,
      maxWidth: options.chatStyles.maxWidth,
      centerInput: options.chatStyles.centerInput,
      welcomeMessage: options.settings.welcomeMessage,
      showWelcomeMessage: options.settings.showWelcomeMessage,
      debug: options.debug,
      buttonText: options.chatStyles.buttonText,
      openFullscreen: options.settings.openFullscreen,
      centerFloatingChat: options.chatMode === 'button' ? true : options.chatStyles.centerFloatingChat,
      inputAreaBackground: options.chatStyles.inputAreaBackground,
      fullScale: options.chatStyles.fullScale,
      testMessageButton: options.testMessageButton,
    }),
    [options]
  );

  return (
    <ChatProvider {...providerProps}>
      {renderChat}

      <ChatHistoryModalHost />
    </ChatProvider>
  );
};
