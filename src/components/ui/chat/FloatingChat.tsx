import ReactDOM from 'react-dom';
import React, { forwardRef } from 'react';
import { useTheme2 } from '@grafana/ui';
import { useChat } from '../core/chatConfig';
import { ChatHeader } from 'components/ui/shared/ChatHeader';
import { ChatTextarea } from 'components/ui/shared/ChatTextarea';
import { MessageList } from 'components/ui/shared/MessageList';
import { BottomButtons } from 'components/ui/shared/BottomButtons';
import { useStyles, getMessageListStyles } from 'components/ui/core/styles';

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

    return ReactDOM.createPortal(
      <div ref={ref} className={styles.floating.chat} style={isFullscreen ? styles.fullscreenStyle : chatStyle}>
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
