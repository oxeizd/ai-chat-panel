import React, { useCallback } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from 'components/ui/core/styles';
import { InputArea } from './InputArea';
import { FloatingChat } from './FloatingChat';
import { useChat } from 'components/ui/core/chatConfig';

export const FloatingChatPanel: React.FC = () => {
  const props = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);
  const {
    sendMessage,
    messages,
    maxWidth,
    centerInput,
    isChatOpen,
    openChat,
    closeChat,
    chatStyle,
    chatMessagesRef,
    inputContainerRef,
    setFloatingChatRefCallback,
    isFullscreen,
    toggleFullscreen,
  } = props;

  const handleSendWithOpen = useCallback(() => {
    sendMessage();
    if (!isChatOpen) openChat();
  }, [sendMessage, isChatOpen, openChat]);
  
  const handleSendText = useCallback((text: string) => {
    sendMessage(text);
    if (!isChatOpen) openChat();
  }, [sendMessage, isChatOpen, openChat]);
  
  const handleContinue = useCallback(() => {
    if (!isChatOpen) openChat();
  }, [isChatOpen, openChat]);

  const hasHistory = messages.length > 0;
  const continueMode = !isChatOpen && hasHistory;

  const wrapperStyle = cx(
    styles.base.normalWrapper,
    maxWidth && maxWidth > 0 ? styles.base.withMaxWidth(maxWidth) : undefined,
    centerInput && !isChatOpen && styles.base.verticalCentered
  );

  return (
    <div className={wrapperStyle}>
      <InputArea
        ref={inputContainerRef}
        onSend={handleSendWithOpen}
        onContinue={handleContinue}
        continueMode={continueMode}
        onSendText={handleSendText}
        className={cx(isChatOpen && styles.input.containerHidden)}
      />
      {isChatOpen && (
        <FloatingChat
          ref={setFloatingChatRefCallback}
          messagesContainerRef={chatMessagesRef}
          chatStyle={isFullscreen ? styles.fullscreenStyle : chatStyle}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onClose={closeChat}
        />
      )}
    </div>
  );
};
