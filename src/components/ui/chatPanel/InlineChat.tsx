import React from 'react';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { useChatState, useChatActions } from '../chat/ChatContext';
import { ChatLayout } from './ChatLayout';
import { FloatingChat } from './FloatingChat';
import { useStyles } from '../styles/styles';

export const InlineChat: React.FC = () => {
  const theme = useTheme2();
  const styles = useStyles(theme);

  const { isFullscreen, messages } = useChatState();
  const {
    toggleFullscreen,
    maxWidth,
    centerInput,
    suggestions,
    suggestionsPlacement,
    showSuggestions,
    handleSuggestionClick,
    chatMessagesRef,
  } = useChatActions();

  const showSuggestionsBlock =
    showSuggestions &&
    suggestionsPlacement === 'always' &&
    suggestions &&
    suggestions.length > 0 &&
    messages.length === 0;

  const wrapperStyle = cx(
    styles.base.normalWrapper,
    maxWidth && maxWidth > 0 ? styles.base.withMaxWidth(maxWidth) : undefined,
    centerInput && styles.base.verticalCentered
  );

  return (
    <>
      <div className={wrapperStyle} style={{ height: '100%' }}>
        <ChatLayout onToggleFullscreen={toggleFullscreen} isFullscreen={false} messagesContainerRef={chatMessagesRef} />

        {showSuggestionsBlock && (
          <div className={styles.suggestions.container}>
            {suggestions!.map((suggestion, idx) => (
              <div key={idx} className={styles.suggestions.item} onClick={() => handleSuggestionClick(suggestion)}>
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {isFullscreen && (
        <FloatingChat
          chatStyle={styles.fullscreenStyle}
          onClose={toggleFullscreen}
          isFullscreen={true}
          onToggleFullscreen={toggleFullscreen}
          messagesContainerRef={chatMessagesRef}
        />
      )}
    </>
  );
};
