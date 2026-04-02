// components/FloatingChat.tsx
import React, { forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '@grafana/ui';
import { useStyles, getMessageListStyles } from './styles';
import { MessageList } from './shared/MessageList';
import { ChatHeader } from './shared/ChatHeader';
import { BottomButtons } from './shared/BottomButtons';
import { ChatTextarea } from './shared/ChatTextarea';
import { useChat } from './shared/ChatContext';

interface FloatingChatProps {
  chatStyle: { left: number; top?: number; bottom?: number; maxHeight: number; width: number };
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
          zIndex: 9999,
        }
      : {
          left: chatStyle.left,
          top: chatStyle.top,
          bottom: chatStyle.bottom,
          maxHeight: chatStyle.maxHeight,
          width: chatStyle.width,
          padding: '16px',
        };

    const effectiveMaxWidth = propMaxWidth ?? props.maxWidth;
    if (effectiveMaxWidth && effectiveMaxWidth > 0 && !isFullscreen) {
      floatingStyle.maxWidth = effectiveMaxWidth;
    }

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
