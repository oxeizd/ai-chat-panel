import ReactDOM from 'react-dom';
import React, { forwardRef } from 'react';
import { useTheme2 } from '@grafana/ui';
import { useStyles } from 'components/ui/styles/styles';
import { ChatLayout } from './ChatLayout';

interface FloatingChatProps {
  chatStyle: React.CSSProperties;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  messagesContainerRef?: React.RefObject<HTMLDivElement>;
}

export const FloatingChat = forwardRef<HTMLDivElement, FloatingChatProps>(
  ({ chatStyle, onClose, isFullscreen, onToggleFullscreen, messagesContainerRef }, ref) => {
    const theme = useTheme2();
    const styles = useStyles(theme);

    return ReactDOM.createPortal(
      <div ref={ref} className={styles.floating.chat} style={isFullscreen ? styles.fullscreenStyle : chatStyle}>
        <ChatLayout
          onBack={isFullscreen ? undefined : onClose}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          messagesContainerRef={messagesContainerRef}
        />
      </div>,
      document.body
    );
  }
);

FloatingChat.displayName = 'FloatingChat';
