import React, { useRef, useState } from 'react';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { useStyles, getMessageListStyles } from './styles';
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
    props.sendMessage(suggestion);
  };

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
          onFullscreen={() => setIsFullscreenOpen(true)}
          isFullscreen={false}
          welcomeMessage={props.showWelcomeMessage ? props.welcomeMessage : undefined}
        />
        <div ref={messagesContainerRef} className={styles.messages.container}>
          <MessageList styles={getMessageListStyles(styles)} showPlaceholder={!props.welcomeMessage} />
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

        <ChatTextarea />
        <BottomButtons />
      </div>
      <FullscreenChatPortal isOpen={isFullscreenOpen} onClose={() => setIsFullscreenOpen(false)} />
    </>
  );
};
