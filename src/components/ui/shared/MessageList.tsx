import React, { useState, useMemo } from 'react';
import { cx } from '@emotion/css';
import { Spinner, Button, Icon, Modal } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { useChat } from 'components/ui/core/chatConfig';
import { DebugTraceModal } from './DebugTraceModal';

export interface MessageListStyles {
  messageWrapper: string;
  userMessageWrapper: string;
  aiMessageWrapper: string;
  messageBubble: string;
  userMessageBubble: string;
  aiMessageBubble: string;
  katex: string;
}

interface MessageListProps {
  showPlaceholder?: boolean;
  styles: MessageListStyles;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeRaw, rehypeSanitize, rehypeKatex];

const ChatMessage = React.memo(
  ({ message, styles, debug, isLastUserMessage, onRetry, onUserMessageClick, onAiMessageClick }: any) => {
    const handleClick = () => {
      if (message.sender === 'user') {
        onUserMessageClick?.(message);
      } else if (message.sender === 'ai') {
        onAiMessageClick?.(message);
      }
    };

    return (
      <div
        className={cx(
          styles.messageWrapper,
          message.sender === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
        )}
        onClick={debug ? handleClick : undefined}
        style={
          debug && (message.sender === 'user' || (message.sender === 'ai' && message.errorDetails))
            ? { cursor: 'pointer' }
            : undefined
        }
      >
        <div
          className={cx(
            styles.messageBubble,
            message.sender === 'user' ? styles.userMessageBubble : styles.aiMessageBubble
          )}
        >
          {message.sender === 'ai' && message.errorDetails && debug ? (
            <>
              ❌ {message.errorDetails.status ? `[${message.errorDetails.status}] ` : ''}
              {message.errorDetails.message}
            </>
          ) : (
            <div className={styles.katex}>
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
                {message.text}
              </ReactMarkdown>
            </div>
          )}
          {debug && message.errorDetails && message.sender === 'ai' && (
            <Icon name="info-circle" style={{ marginLeft: '8px', fontSize: '14px', opacity: 0.7 }} />
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

  const handleUserMessageClick = (msg: any) => {
    if (debug && getTrace) {
      const trace = getTrace(msg.id);
      if (trace) {
        setSelectedTrace(trace);
        setTraceModalOpen(true);
      }
    }
  };

  const handleAiMessageClick = (msg: any) => {
    if (debug && msg.errorDetails) {
      setErrorDetails(msg.errorDetails);
    }
  };

  const handleRetry = (messageId: string) => {
    retryMessage?.(messageId);
  };

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
          <div>
            <p>
              <strong>Статус:</strong> {errorDetails.status || 'неизвестно'}
            </p>
            <p>
              <strong>Сообщение:</strong> {errorDetails.message}
            </p>
            {errorDetails.raw && (
              <details>
                <summary>Техническая информация</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', marginTop: '8px' }}>{errorDetails.raw}</pre>
              </details>
            )}
          </div>
          <Modal.ButtonRow>
            <Button variant="secondary" onClick={() => setErrorDetails(null)}>
              Закрыть
            </Button>
          </Modal.ButtonRow>
        </Modal>
      )}

      <DebugTraceModal isOpen={traceModalOpen} trace={selectedTrace} onDismiss={() => setTraceModalOpen(false)} />
    </>
  );
});

MessageList.displayName = 'MessageList';
