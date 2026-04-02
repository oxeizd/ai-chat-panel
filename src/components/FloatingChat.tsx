import React from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '@grafana/ui';
import { getStyles } from './styles';
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
  maxWidth?: number; // добавляем
}

export const FloatingChat: React.FC<FloatingChatProps> = ({ chatStyle, onClose, isFullscreen, onToggleFullscreen, maxWidth }) => {
  const props = useChat(); // все данные из контекста
  const theme = useTheme2();
  const styles = getStyles(theme);

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

  // Добавляем maxWidth только для не-fullscreen режима
  if (maxWidth && maxWidth > 0 && !isFullscreen) {
    floatingStyle.maxWidth = maxWidth;
  }

  const messageListStyles = {
    messageWrapper: styles.messages.wrapper,
    userMessageWrapper: styles.messages.userWrapper,
    aiMessageWrapper: styles.messages.aiWrapper,
    messageBubble: styles.messages.bubble,
    userMessageBubble: styles.messages.userBubble,
    aiMessageBubble: styles.messages.aiBubble,
  };

  return ReactDOM.createPortal(
    <div className={styles.floating.chat} style={floatingStyle}>
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
      <div className={styles.messages.container}>
        <MessageList
          messages={props.messages}
          isLoading={props.isLoading}
          placeholderText={props.placeholderText}
          styles={messageListStyles}
        />
      </div>
      <ChatTextarea
        value={props.inputValue}
        onChange={(e) => props.setInputValue(e.target.value)}
        onSend={props.sendMessage}
        isLoading={props.isLoading}
        placeholder={props.placeholderText}
        isFloating={true}
      />
      <BottomButtons
        selectedAgent={props.selectedAgent}
        agents={props.agents}
        onSelectAgent={props.setSelectedAgent}
        onNewChat={props.newChat}
        agentButtonClassName={styles.bottomButtons.agentButton}
        newChatButtonClassName={styles.bottomButtons.newChatButton}
        menuClassName={styles.menu.customMenu}
      />
    </div>,
    document.body
  );
};