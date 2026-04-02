import React from 'react';
import { cx } from '@emotion/css';
import { Spinner, Button, Icon } from '@grafana/ui';
import { useChat } from './ChatContext';

export interface MessageListStyles {
  messageWrapper: string;
  userMessageWrapper: string;
  aiMessageWrapper: string;
  messageBubble: string;
  userMessageBubble: string;
  aiMessageBubble: string;
}

interface MessageListProps {
  showPlaceholder?: boolean;
  styles: MessageListStyles;
}

export const MessageList: React.FC<MessageListProps> = ({ showPlaceholder = true, styles }) => {
  const { messages, isLoading, placeholderText, retryMessage } = useChat();

  let lastUserMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

  return (
    <>
      {messages.length === 0 && showPlaceholder && placeholderText && (
        <div style={{ textAlign: 'center', opacity: 0.7, padding: '20px' }}>{placeholderText}</div>
      )}
      {messages.map((msg, idx) => (
        <div
          key={msg.id}
          className={cx(
            styles.messageWrapper,
            msg.sender === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
          )}
        >
          <div
            className={cx(
              styles.messageBubble,
              msg.sender === 'user' ? styles.userMessageBubble : styles.aiMessageBubble
            )}
          >
            {msg.text}
          </div>
          {msg.sender === 'user' && msg.error && (
            <div style={{ marginLeft: '8px', alignSelf: 'center' }}>
              {idx === lastUserMessageIndex ? (
                <Button
                  icon="repeat"
                  size="sm"
                  variant="secondary"
                  onClick={() => retryMessage?.(msg.id)}
                  aria-label="Повторить отправку"
                />
              ) : (
                <Icon name="exclamation-triangle" style={{ color: 'orange' }} />
              )}
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className={cx(styles.messageWrapper, styles.aiMessageWrapper)}>
          <div className={cx(styles.messageBubble, styles.aiMessageBubble)}>
            <Spinner />
          </div>
        </div>
      )}
    </>
  );
};
