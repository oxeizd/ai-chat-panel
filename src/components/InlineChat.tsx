// components/InlineChat.tsx
import React, { useRef, useState } from 'react';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { useStyles } from './styles';
import { MessageList } from './shared/MessageList';
import { ChatHeader } from './shared/ChatHeader';
import { BottomButtons } from './shared/BottomButtons';
import { ChatTextarea } from './shared/ChatTextarea';
import { FullscreenChatPortal } from './shared/FullscreenChatPortal';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useChat } from './shared/ChatContext';

export const InlineChat: React.FC = () => {
  const props = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  useAutoScroll(messagesContainerRef, [props.messages]);

  const handleSuggestionClick = (suggestion: string) => {
    props.setInputValue(suggestion);
    props.sendMessage();
  };

  const openFullscreen = () => setIsFullscreenOpen(true);
  const closeFullscreen = () => setIsFullscreenOpen(false);

  const showSuggestions =
    props.showSuggestions &&
    props.suggestionsPlacement === 'always' &&
    props.suggestions &&
    props.suggestions.length > 0 &&
    props.messages.length === 0;

  const wrapperStyle = cx(
    styles.base.normalWrapper,
    props.maxWidth && props.maxWidth > 0 ? styles.base.withMaxWidth(props.maxWidth) : undefined,
    props.centerInput && styles.base.verticalCentered
  );

  const messageListStyles = {
    messageWrapper: styles.messages.wrapper,
    userMessageWrapper: styles.messages.userWrapper,
    aiMessageWrapper: styles.messages.aiWrapper,
    messageBubble: styles.messages.bubble,
    userMessageBubble: styles.messages.userBubble,
    aiMessageBubble: styles.messages.aiBubble,
  };

  return (
    <>
      <div className={wrapperStyle} style={{ height: '100%' }}>
        <ChatHeader
          agents={props.agents}
          onClearChat={props.clearChat}
          onExportChat={props.exportChat}
          onOpenSettings={props.openSettings}
          onSelectAgent={props.setSelectedAgent}
          menuClassName={styles.menu.customMenu}
          iconButtonClassName={styles.header.iconButton}
          welcomeMessage={props.showWelcomeMessage ? props.welcomeMessage : undefined}
          onFullscreen={openFullscreen}
          isFullscreen={false}
        />

        <div ref={messagesContainerRef} className={styles.messages.container}>
          <MessageList
            messages={props.messages}
            isLoading={props.isLoading}
            placeholderText={props.placeholderText}
            showPlaceholder={!props.welcomeMessage}
            styles={messageListStyles}
          />
        </div>

        {showSuggestions && (
          <div className={styles.suggestions.container}>
            {props.suggestions!.map((suggestion, idx) => (
              <div key={idx} className={styles.suggestions.item} onClick={() => handleSuggestionClick(suggestion)}>
                {suggestion}
              </div>
            ))}
          </div>
        )}

        <ChatTextarea
          value={props.inputValue}
          onChange={(e) => props.setInputValue(e.target.value)}
          onSend={props.sendMessage}
          isLoading={props.isLoading}
          placeholder={props.placeholderText}
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
      </div>

      <FullscreenChatPortal
        isOpen={isFullscreenOpen}
        onClose={closeFullscreen}
      />
    </>
  );
};