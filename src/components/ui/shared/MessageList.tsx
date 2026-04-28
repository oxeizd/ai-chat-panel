import React, { useState } from 'react';
import { cx } from '@emotion/css';
import { Spinner, Button, Icon, Modal } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// @ts-ignore
import 'katex/dist/katex.min.css';

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

export const MessageList: React.FC<MessageListProps> = React.memo(({ showPlaceholder = true, styles }) => {
  const { messages, isLoading, placeholderText, retryMessage, debug, getTrace } = useChat();
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<any>(null);

  let lastUserMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

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
          onClick={() => {
            if (msg.sender === 'user') {
              handleUserMessageClick(msg);
            } else if (msg.sender === 'ai') {
              handleAiMessageClick(msg);
            }
          }}
          style={
            debug && (msg.sender === 'user' || (msg.sender === 'ai' && msg.errorDetails))
              ? { cursor: 'pointer' }
              : undefined
          }
        >
          <div
            className={cx(
              styles.messageBubble,
              msg.sender === 'user' ? styles.userMessageBubble : styles.aiMessageBubble
            )}
          >
            {msg.sender === 'ai' && msg.errorDetails && debug ? (
              <>
                ❌ {msg.errorDetails.status ? `[${msg.errorDetails.status}] ` : ''}
                {msg.errorDetails.message}
              </>
            ) : (
              <div className={styles.katex}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
            {debug && msg.errorDetails && msg.sender === 'ai' && (
              <Icon name="info-circle" style={{ marginLeft: '8px', fontSize: '14px', opacity: 0.7 }} />
            )}
          </div>

          {msg.sender === 'user' && msg.error && (
            <div style={{ marginLeft: '8px', alignSelf: 'center' }}>
              {idx === lastUserMessageIndex ? (
                <Button
                  icon="repeat"
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    retryMessage?.(msg.id);
                  }}
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
