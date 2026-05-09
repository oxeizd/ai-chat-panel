import React, { useCallback } from 'react';
import { cx } from '@emotion/css';
import { Button, Icon } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';

// @ts-ignore
import 'katex/dist/katex.min.css';
import { MessageListStyles } from './MessageList';
import { downloadFile } from 'components/agent/core/processing/helpers/fileHandler';
import { REMARK_PLUGINS, REHYPE_PLUGINS } from '../utils/markdown/plugins';

interface ChatMessageProps {
  message: {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    error?: boolean;
    errorDetails?: any;
    fileAttachment?: {
      filename: string;
      data: string;
      mimeType?: string;
      isUrl?: boolean;
    };
    thinking?: string;
    isThinking?: boolean;
  };
  styles: MessageListStyles;
  debug: boolean;
  isLastUserMessage: boolean;
  onRetry: (messageId: string) => void;
  onUserMessageClick: (message: any) => void;
  onAiMessageClick: (message: any) => void;
  markdownComponents: any;
}

export const ChatMessage = React.memo(
  ({
    message,
    styles,
    debug,
    isLastUserMessage,
    onRetry,
    onUserMessageClick,
    onAiMessageClick,
    markdownComponents,
  }: ChatMessageProps) => {
    const handleClick = useCallback(() => {
      if (message.sender === 'user') {
        onUserMessageClick?.(message);
      }
    }, [message, onUserMessageClick]);

    const handleInfoClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onAiMessageClick?.(message);
      },
      [message, onAiMessageClick]
    );

    const handleRetryClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onRetry?.(message.id);
      },
      [message.id, onRetry]
    );

    return (
      <div
        className={cx(
          styles.messageWrapper,
          message.sender === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
        )}
        onClick={handleClick}
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
              {/* Мысли — спойлер */}
              {(message.thinking || message.isThinking) && (
                <details open={message.isThinking} style={{ marginBottom: 8 }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      color: message.isThinking ? '#fbbf24' : '#94a3b8',
                      fontSize: '0.85rem',
                      fontStyle: 'italic',
                      padding: '4px 0',
                      transition: 'color 0.2s',
                      userSelect: 'none',
                    }}
                  >
                    {message.isThinking ? ' Думает...' : ' Размышления'}
                  </summary>
                  <div
                    style={{
                      padding: '8px 12px',
                      margin: '4px 0',
                      background: 'rgba(148,163,184,0.08)',
                      borderRadius: 6,
                      borderLeft: '3px solid rgba(148,163,184,0.3)',
                      fontSize: '0.85rem',
                      color: '#94a3b8',
                      whiteSpace: 'pre-wrap',
                      maxHeight: message.isThinking ? 'none' : '300px',
                      overflowY: 'auto',
                    }}
                  >
                    {message.thinking}
                    {message.isThinking && <span className={styles.blinkCursor} />}
                  </div>
                </details>
              )}

              <div className={styles.katex}>
                <ReactMarkdown
                  remarkPlugins={REMARK_PLUGINS}
                  rehypePlugins={REHYPE_PLUGINS as any}
                  components={markdownComponents}
                >
                  {message.text}
                </ReactMarkdown>
              </div>

              {message.fileAttachment && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download-alt"
                    onClick={() => {
                      if (message.fileAttachment) {
                        downloadFile(message.fileAttachment);
                      }
                    }}
                  >
                    📄 {message.fileAttachment.filename}
                  </Button>
                </div>
              )}

              {debug && message.errorDetails && (
                <Icon
                  name="info-circle"
                  style={{ fontSize: '14px', opacity: 0.7, cursor: 'pointer', alignSelf: 'center' }}
                  onClick={handleInfoClick}
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
                onClick={handleRetryClick}
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
