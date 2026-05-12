import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cx } from '@emotion/css';
import { Spinner, Modal } from '@grafana/ui';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { DebugTraceModal } from '../debug/DebugTraceModal';
import { useMarkdownComponents } from '../utils/markdown/useComponents';
import { ChatMessage } from './ChatMessage';

export interface MessageListStyles {
  messageWrapper: string;
  userMessageWrapper: string;
  aiMessageWrapper: string;
  messageBubble: string;
  userMessageBubble: string;
  aiMessageBubble: string;
  katex: string;
  chartContainer: string;
  blinkCursor: string;
}

interface MessageListProps {
  showPlaceholder?: boolean;
  styles: MessageListStyles;
}

export const MessageList: React.FC<MessageListProps> = React.memo(({ showPlaceholder = true, styles }) => {
  const { messages, isLoading } = useChatState();
  const { placeholderText, retryMessage, debug, getTrace } = useChatActions();
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(atBottom);
    }
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, autoScroll]);

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
      <div ref={containerRef} onScroll={handleScroll} style={{ overflowY: 'auto', flex: 1, height: '100%' }}>
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
      </div>

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
