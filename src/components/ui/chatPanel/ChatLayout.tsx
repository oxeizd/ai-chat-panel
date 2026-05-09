import React from 'react';
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

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  onBack,
  isFullscreen,
  onToggleFullscreen,
  messagesContainerRef,
}) => {
  const theme = useTheme2();
  const styles = useStyles(theme);

  const { isFullscreen: isFs } = useChatState();

  return (
    <>
      <ChatHeader onBack={onBack} isFullscreen={isFullscreen ?? isFs} onFullscreen={onToggleFullscreen} />
      <div ref={messagesContainerRef} className={styles.messages.container}>
        <MessageList styles={getMessageListStyles(styles)} />
      </div>
      <ChatTextarea />
      <BottomButtons />
    </>
  );
};
