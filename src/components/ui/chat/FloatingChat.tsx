import React, { forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '@grafana/ui';
import { useStyles, getMessageListStyles } from 'components/ui/core/styles';
import { MessageList } from 'components/ui/shared/MessageList';
import { ChatHeader } from 'components/ui/shared/ChatHeader';
import { BottomButtons } from 'components/ui/shared/BottomButtons';
import { ChatTextarea } from 'components/ui/shared/ChatTextarea';
import { useChat } from '../core/chatConfig';

interface FloatingChatProps {
  chatStyle: React.CSSProperties;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  messagesContainerRef?: React.RefObject<HTMLDivElement>;
  maxWidth?: number;
}

export const FloatingChat = forwardRef<HTMLDivElement, FloatingChatProps>(
  ({ chatStyle, onClose, isFullscreen, onToggleFullscreen, messagesContainerRef, maxWidth: propMaxWidth }, ref) => {
    const props = useChat();
    const theme = useTheme2();
    const styles = useStyles(theme);

    const floatingStyle: React.CSSProperties = isFullscreen
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxHeight: '100vh',
          padding: '16px',
          borderRadius: 0,
          zIndex: 1999,
        }
      : {
          left: chatStyle.left,
          top: chatStyle.top,
          bottom: chatStyle.bottom,
          maxHeight: chatStyle.maxHeight,
          width: chatStyle.width,
          padding: '16px',
        };

    return ReactDOM.createPortal(
      <div ref={ref} className={styles.floating.chat} style={floatingStyle}>
        <ChatHeader
          onBack={isFullscreen ? undefined : onClose}
          isFullscreen={isFullscreen}
          onFullscreen={onToggleFullscreen}
          welcomeMessage={props.showWelcomeMessage ? props.welcomeMessage : undefined}
        />
        <div ref={messagesContainerRef} className={styles.messages.container}>
          <MessageList styles={getMessageListStyles(styles)} />
        </div>
        <ChatTextarea />
        <BottomButtons />
      </div>,
      document.body
    );
  }
);

FloatingChat.displayName = 'FloatingChat';
