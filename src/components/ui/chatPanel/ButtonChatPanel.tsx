import React from 'react';
import { Button } from '@grafana/ui';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { FloatingChat } from './FloatingChat';

export const ButtonChatPanel: React.FC = () => {
  const { isChatOpen, isFullscreen, isLoading } = useChatState();
  const { openChat, closeChat, toggleFullscreen, chatMessagesRef, buttonText, openFullscreen, chatStyle } =
    useChatActions();

  const handleOpenChat = () => {
    if (isLoading) {
      return;
    }
    openChat();
    if (openFullscreen) {
      toggleFullscreen();
    }
  };

  if (!isChatOpen) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Button onClick={handleOpenChat} variant="secondary" icon="comments-alt" size="md" disabled={isLoading}>
          {buttonText || 'Open Chat'}
        </Button>
      </div>
    );
  }

  return (
    <FloatingChat
      chatStyle={chatStyle}
      onClose={closeChat}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      messagesContainerRef={chatMessagesRef}
    />
  );
};
