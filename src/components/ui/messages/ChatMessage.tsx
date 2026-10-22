import React, { useCallback } from 'react';
import { cx } from '@emotion/css';
import { Button, Icon } from '@grafana/ui';
import ReactMarkdown from 'react-markdown';

// @ts-ignore
import 'katex/dist/katex.min.css';
import { MessageListStyles } from './MessageList';
import { REMARK_PLUGINS, REHYPE_PLUGINS } from '../utils/markdown/plugins';
import { downloadFile } from 'components/agent/utils/download';
import { preprocessMarkdown } from './hooks/utils/preprocess';
import { ChartComponent } from 'components/ui/utils/markdown/chartComponent/ChartComponent';
import { isValidChartConfig } from 'components/ui/utils/markdown/chartParsing';

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
    traceSteps?: any[];
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

    const content = preprocessMarkdown(message.text);

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
                      color: message.isThinking ? 'rgb(90, 134, 222)' : '#94a3b8',
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
                  {content}
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

              {/* AG-UI trace steps — reasoning, tool calls */}
              {message.traceSteps && message.traceSteps.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {message.traceSteps.map((step: any, idx: number) => {
                    // Пропускаем служебные события — они не нужны в UI
                    if (
                      step.type?.startsWith('text:') ||
                      step.type?.startsWith('run:') ||
                      step.type === 'state:snapshot' ||
                      step.type === 'state:delta'
                    ) {
                      return null;
                    }

                    // Reasoning — отображаем как thinking
                    if (step.type?.startsWith('reasoning:')) {
                      if (step.type === 'reasoning:start' || step.type === 'reasoning:end') {
                        return null;
                      }

                      return (
                        <details
                          key={idx}
                          open={false}
                          style={{
                            marginBottom: 4,
                            padding: '4px 8px',
                            background: 'rgba(148,163,184,0.08)',
                            borderRadius: 4,
                            borderLeft: '2px solid rgba(148,163,184,0.3)',
                          }}
                        >
                          <summary
                            style={{
                              cursor: 'pointer',
                              color: '#94a3b8',
                              fontSize: '0.8rem',
                              fontStyle: 'italic',
                            }}
                          >
                            💭 Thinking...
                          </summary>
                          <div
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              color: '#94a3b8',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '200px',
                              overflowY: 'auto',
                            }}
                          >
                            {step.delta || step.text || ''}
                          </div>
                        </details>
                      );
                    }

                    // Tool calls — отображаем как карточки
                    if (step.type?.startsWith('tool:')) {
                      const isEnd = step.type === 'tool:end';
                      const isArgs = step.type === 'tool:args';
                      const isResult = step.type === 'tool:result';

                      if (isEnd || isArgs) {
                        return null;
                      } // Пропускаем

                      return (
                        <details
                          key={idx}
                          open={false}
                          style={{
                            marginBottom: 4,
                            padding: '4px 8px',
                            background: 'rgba(59,130,246,0.08)',
                            borderRadius: 4,
                            borderLeft: '2px solid rgba(59,130,246,0.3)',
                          }}
                        >
                          <summary
                            style={{
                              cursor: 'pointer',
                              color: '#3b82f6',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                            }}
                          >
                            🔧 {step.toolName || 'Tool Call'}
                          </summary>
                          <div
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              color: '#64748b',
                              fontFamily: 'monospace',
                            }}
                          >
                            {isResult ? (
                              <div>
                                <div style={{ marginBottom: 4, fontWeight: 500 }}>Result:</div>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                  {step.content || step.delta || ''}
                                </pre>
                              </div>
                            ) : (
                              <div>
                                {step.toolCallId && (
                                  <div style={{ marginBottom: 4, opacity: 0.7 }}>ID: {step.toolCallId}</div>
                                )}
                                <div>Args: {step.delta || ''}</div>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    }

                    // Steps — отображаем как прогресс
                    if (step.type?.startsWith('step:')) {
                      if (step.type === 'step:end') {
                        return null;
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ opacity: 0.5 }}>⏳</span>
                          {step.stepName || 'Processing...'}
                        </div>
                      );
                    }

                    // Custom events — рендерим графики и другой кастомный контент
                    if (step.type === 'custom') {
                      try {
                        const chartData = step.data?.chart || step.data?.data;
                        if (chartData && isValidChartConfig(chartData)) {
                          return (
                            <div key={idx} className="chartContainer" style={{ marginTop: 8 }}>
                              <ChartComponent config={chartData} />
                            </div>
                          );
                        }
                      } catch (err) {
                        console.error('Custom chart parsing error:', err);
                      }
                      // Если не график — показываем как JSON
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            background: 'rgba(148,163,184,0.08)',
                            borderRadius: 4,
                            marginTop: 4,
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(step.data, null, 2)}</pre>
                        </div>
                      );
                    }

                    // Default — показываем как есть
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          color: '#64748b',
                        }}
                      >
                        {JSON.stringify(step)}
                      </div>
                    );
                  })}
                </div>
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
