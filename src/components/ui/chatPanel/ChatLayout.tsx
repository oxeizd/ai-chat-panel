import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2 } from '@grafana/ui';
import { useChatState } from '../chat/ChatContext';
import { ChatHeader } from '../toolbar/ChatHeader';
import { ChatTextarea } from './ChatTextarea';
import { MessageList } from '../messages/MessageList';
import { BottomButtons } from '../toolbar/BottomButtons';
import { useStyles, getMessageListStyles } from '../styles/styles';

interface ChatLayoutProps {
  onBack?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  messagesContainerRef?: React.RefObject<HTMLDivElement>;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ onBack, isFullscreen, onToggleFullscreen }) => {
  const theme = useTheme2();
  const styles = useStyles(theme);
  const messageListStyles = useMemo(() => getMessageListStyles(styles), [styles]);
  const { isFullscreen: isFs, messages } = useChatState();

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

  return (
    <>
      <ChatHeader onBack={onBack} isFullscreen={isFullscreen ?? isFs} onFullscreen={onToggleFullscreen} />
      <div ref={containerRef} className={styles.messages.container} onScroll={handleScroll}>
        <div style={{ padding: theme.spacing(2), display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }}>
          <MessageList styles={messageListStyles} />
        </div>
      </div>
      <ChatTextarea />
      <BottomButtons />
    </>
  );
};
