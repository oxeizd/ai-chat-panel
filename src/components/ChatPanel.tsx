import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from 'types';
import { InlineChat } from './ui/chat/InlineChat';
import { FloatingChatPanel } from './ui/chat/FloatingChatPanel';
import { ButtonChatPanel } from './ui/chat/ButtonChatPanel';
import { ChatProvider } from './ui/core/chatConfig';

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
      placeholderText: options.placeholderText,
      suggestions: options.suggestions,
      suggestionsPlacement: options.suggestionsPlacement,
      showSuggestions: options.showSuggestions,
      maxWidth: options.maxWidth,
      centerInput: options.centerInput,
      welcomeMessage: options.welcomeMessage,
      showWelcomeMessage: options.showWelcomeMessage,
      debug: options.debug,
      buttonText: options.buttonText,
      openFullscreen: options.openFullscreen,
      centerFloatingChat: options.chatMode === 'button' ? true : options.centerFloatingChat,
    }),
    [options]
  );

  return <ChatProvider {...providerProps}>{renderChat}</ChatProvider>;
};
