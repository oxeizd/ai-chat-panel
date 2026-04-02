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
  maxWidth?: number;
  messagesContainerRef?: React.RefObject<HTMLDivElement>;
}

export const FloatingChat = forwardRef<HTMLDivElement, FloatingChatProps>(
  ({ chatStyle, onClose, isFullscreen, onToggleFullscreen, maxWidth, messagesContainerRef }, ref) => {
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
          zIndex: 1000,
        }
      : {
          left: chatStyle.left,
          top: chatStyle.top,
          bottom: chatStyle.bottom,
          maxHeight: chatStyle.maxHeight,
          width: chatStyle.width,
          padding: '16px',
        };

    if (maxWidth && maxWidth > 0 && !isFullscreen) {
      floatingStyle.maxWidth = maxWidth;
    }

    return ReactDOM.createPortal(
      <div ref={ref} className={styles.floating.chat} style={floatingStyle}>
        <ChatHeader
          onBack={isFullscreen ? undefined : onClose}
          agents={props.agents}
          onClearChat={props.clearChat}
          onExportChat={props.exportChat}
          onOpenSettings={props.openSettings}
          onSelectAgent={props.setSelectedAgent}
          menuClassName={styles.menu.customMenu}
          iconButtonClassName={styles.header.iconButton}
          welcomeMessage={props.showWelcomeMessage ? props.welcomeMessage : undefined}
          isFullscreen={isFullscreen}
          onFullscreen={onToggleFullscreen}
        />
        <div ref={messagesContainerRef} className={styles.messages.container}>
          <MessageList
            messages={props.messages}
            isLoading={props.isLoading}
            placeholderText={props.placeholderText}
            styles={getMessageListStyles(styles)}
          />
        </div>
        <ChatTextarea />
        <BottomButtons />
      </div>,
      document.body
    );
  }
);

FloatingChat.displayName = 'FloatingChat';
