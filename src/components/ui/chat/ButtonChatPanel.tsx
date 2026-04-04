import React from 'react';
import ReactDOM from 'react-dom';
import { Button, useTheme2 } from '@grafana/ui';
import { useStyles, getMessageListStyles } from '../core/styles';
import { MessageList } from '../shared/MessageList';
import { ChatHeader } from '../shared/ChatHeader';
import { BottomButtons } from '../shared/BottomButtons';
import { ChatTextarea } from '../shared/ChatTextarea';
import { useChat } from '../core/chatConfig';

export const ButtonChatPanel: React.FC = () => {
  const {
    isChatOpen,
    openChat,
    closeChat,
    isFullscreen,
    toggleFullscreen,
    chatMessagesRef,
    maxWidth,
    buttonText,
    openFullscreen,
  } = useChat();

  const theme = useTheme2();
  const styles = useStyles(theme);

  const handleOpenChat = () => {
    openChat();
    if (openFullscreen) toggleFullscreen();
  };

  const chatWidth = maxWidth && maxWidth > 0 ? maxWidth : 450;
  const centeredStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: `calc(50% - ${chatWidth / 2}px)`,
    width: chatWidth,
    maxHeight: '80vh',
    background: theme.colors.background.primary,
    backdropFilter: 'blur(8px)',
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 10000,
    transform: 'translateY(-50%)',
    padding: '16px'
  };

  if (!isChatOpen) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Button onClick={handleOpenChat} variant="primary" icon="comments-alt" size="md">
          {buttonText || 'Open Chat'}
        </Button>
      </div>
    );
  }

  return ReactDOM.createPortal(
    <div className={styles.floating.chat} style={centeredStyle}>
      <ChatHeader
        onBack={closeChat}
        isFullscreen={isFullscreen}
        onFullscreen={toggleFullscreen}
      />
      <div ref={chatMessagesRef} className={styles.messages.container}>
        <MessageList styles={getMessageListStyles(styles)} />
      </div>
      <ChatTextarea />
      <BottomButtons />
    </div>,
    document.body
  );
};