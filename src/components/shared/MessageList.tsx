import React from 'react';
import { cx } from '@emotion/css';
import { Spinner } from '@grafana/ui';
import { Message } from 'types';

export interface MessageListStyles {
  messageWrapper: string;
  userMessageWrapper: string;
  aiMessageWrapper: string;
  messageBubble: string;
  userMessageBubble: string;
  aiMessageBubble: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  placeholderText?: string;
  showPlaceholder?: boolean;
  styles: MessageListStyles;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  placeholderText,
  showPlaceholder = true,
  styles,
}) => (
  <>
    {messages.length === 0 && showPlaceholder && placeholderText && (
      <div style={{ textAlign: 'center', opacity: 0.7, padding: '20px' }}>{placeholderText}</div>
    )}
    {messages.map((msg) => (
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
