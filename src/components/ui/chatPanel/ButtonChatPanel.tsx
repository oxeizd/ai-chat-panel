import React from 'react';
import { Button } from '@grafana/ui';
import { useChat } from '../chat/ChatContext';
import { FloatingChat } from './FloatingChat';

export const ButtonChatPanel: React.FC = () => {
  const {
    isChatOpen,
    openChat,
    closeChat,
    isFullscreen,
    toggleFullscreen,
    chatMessagesRef,
    buttonText,
    openFullscreen,
    isLoading,
    chatStyle,
  } = useChat();

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
