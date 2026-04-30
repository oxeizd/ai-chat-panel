import React, { useState, useMemo, useCallback } from 'react';
import { cx } from '@emotion/css';
import { Spinner, Button, Icon, Modal } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import 'katex/dist/katex.min.css';

import { useChat } from 'components/ui/core/chatConfig';
import { DebugTraceModal } from './DebugTraceModal';
import { REMARK_PLUGINS, REHYPE_PLUGINS } from '../utils/markdown/plugins';
import { useMarkdownComponents } from '../utils/markdown/useComponents';

export interface MessageListStyles {
  messageWrapper: string;
  userMessageWrapper: string;
  aiMessageWrapper: string;
  messageBubble: string;
  userMessageBubble: string;
  aiMessageBubble: string;
  katex: string;
  chartContainer: string;
}

interface MessageListProps {
  showPlaceholder?: boolean;
  styles: MessageListStyles;
}

const ChatMessage = React.memo(
  ({
    message,
    styles,
    debug,
    isLastUserMessage,
    onRetry,
    onUserMessageClick,
    onAiMessageClick,
    markdownComponents,
  }: any) => {
    return (
      <div
        className={cx(
          styles.messageWrapper,
          message.sender === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
        )}
        onClick={() => {
          if (message.sender === 'user') {
            onUserMessageClick?.(message);
          }
        }}
        style={debug && message.sender === 'user' ? { cursor: 'pointer' } : undefined}
      >
        <div
          className={cx(
            styles.messageBubble,
            message.sender === 'user' ? styles.userMessageBubble : styles.aiMessageBubble
          )}
        >
          {message.sender === 'user' ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text}</div>
          ) : (
            <>
              <div className={styles.katex}>
                <ReactMarkdown
                  remarkPlugins={REMARK_PLUGINS}
                  rehypePlugins={REHYPE_PLUGINS}
                  components={markdownComponents}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
              {debug && message.errorDetails && (
                <Icon
                  name="info-circle"
                  style={{ fontSize: '14px', opacity: 0.7, cursor: 'pointer', alignSelf: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAiMessageClick?.(message);
                  }}
                />
              )}
            </>
          )}
        </div>
        {message.sender === 'user' && message.error && (
          <div style={{ marginLeft: '8px', alignSelf: 'center' }}>
            {isLastUserMessage ? (
              <Button
                icon="repeat"
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.(message.id);
                }}
                aria-label="Повторить отправку"
              />
            ) : (
              <Icon name="exclamation-triangle" style={{ color: 'orange' }} />
            )}
          </div>
        )}
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export const MessageList: React.FC<MessageListProps> = React.memo(({ showPlaceholder = true, styles }) => {
  const { messages, isLoading, placeholderText, retryMessage, debug, getTrace } = useChat();
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<any>(null);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const handleUserMessageClick = useCallback(
    (msg: any) => {
      if (debug && getTrace) {
        const trace = getTrace(msg.id);
        if (trace) {
          setSelectedTrace(trace);
          setTraceModalOpen(true);
        }
      }
    },
    [debug, getTrace]
  );

  const handleAiMessageClick = useCallback(
    (msg: any) => {
      if (debug && msg.errorDetails) {
        setErrorDetails(msg.errorDetails);
      }
    },
    [debug]
  );

  const handleRetry = useCallback(
    (messageId: string) => {
      retryMessage?.(messageId);
    },
    [retryMessage]
  );

  const markdownComponents = useMarkdownComponents(styles.chartContainer);

  return (
    <>
      {messages.length === 0 && showPlaceholder && placeholderText && (
        <div style={{ textAlign: 'center', opacity: 0.7, padding: '20px' }}>{placeholderText}</div>
      )}

      {messages.map((msg, idx) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          styles={styles}
          debug={debug}
          isLastUserMessage={idx === lastUserMessageIndex}
          onRetry={handleRetry}
          onUserMessageClick={handleUserMessageClick}
          onAiMessageClick={handleAiMessageClick}
          markdownComponents={markdownComponents}
        />
      ))}

      {isLoading && (
        <div className={cx(styles.messageWrapper, styles.aiMessageWrapper)}>
          <div className={cx(styles.messageBubble, styles.aiMessageBubble)}>
            <Spinner />
          </div>
        </div>
      )}

      {debug && errorDetails && (
        <Modal title="Детали ошибки" isOpen={!!errorDetails} onDismiss={() => setErrorDetails(null)}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{JSON.stringify(errorDetails, null, 2)}</pre>
        </Modal>
      )}

      <DebugTraceModal isOpen={traceModalOpen} trace={selectedTrace} onDismiss={() => setTraceModalOpen(false)} />
    </>
  );
});

MessageList.displayName = 'MessageList';
