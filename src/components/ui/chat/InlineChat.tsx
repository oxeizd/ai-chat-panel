import React from 'react';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { useChat } from '../core/chatConfig';
import { FloatingChat } from './FloatingChat';
import { ChatHeader } from '../shared/ChatHeader';
import { ChatTextarea } from '../shared/ChatTextarea';
import { MessageList } from '../shared/MessageList';
import { BottomButtons } from '../shared/BottomButtons';
import { useStyles, getMessageListStyles } from '../core/styles';

export const InlineChat: React.FC = () => {
  const props = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);
  const { isFullscreen, toggleFullscreen } = props;

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

  return (
    <>
      <div className={wrapperStyle} style={{ height: '100%' }}>
        <ChatHeader
          onFullscreen={toggleFullscreen}
          isFullscreen={false}
          welcomeMessage={props.showWelcomeMessage ? props.welcomeMessage : undefined}
        />
        <div ref={props.chatMessagesRef} className={styles.messages.container}>
          <MessageList styles={getMessageListStyles(styles)} showPlaceholder={!props.welcomeMessage} />
        </div>

        {showSuggestions && (
          <div className={styles.suggestions.container}>
            {props.suggestions!.map((suggestion, idx) => (
              <div
                key={idx}
                className={styles.suggestions.item}
                onClick={() => props.handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}

        <ChatTextarea />
        <BottomButtons />
      </div>

      {isFullscreen && (
        <FloatingChat
          chatStyle={styles.fullscreenStyle}
          onClose={toggleFullscreen}
          isFullscreen={true}
          onToggleFullscreen={toggleFullscreen}
          messagesContainerRef={props.chatMessagesRef}
          maxWidth={props.maxWidth}
        />
      )}
    </>
  );
};
