import React, { useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from 'components/ui/core/styles';
import { InputArea } from './InputArea';
import { FloatingChat } from './FloatingChat';
import { useChat } from 'components/ui/core/ChatConfig';

export const FloatingChatPanel: React.FC = () => {
  const props = useChat();
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
  } = props;
  const theme = useTheme2();
  const styles = useStyles(theme);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    document.body.classList.add('fullscreen-chat-open');
    if (!document.getElementById('fullscreen-chat-styles')) {
      const styleTag = document.createElement('style');
      styleTag.id = 'fullscreen-chat-styles';
      styleTag.textContent = `
        body.fullscreen-chat-open {
          overflow: hidden !important;
        }
        body.fullscreen-chat-open .main-view,
        body.fullscreen-chat-open .page-scrollbar,
        body.fullscreen-chat-open .grafana-app {
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(styleTag);
    }
    return () => {
      document.body.classList.remove('fullscreen-chat-open');
      const styleTagEl = document.getElementById('fullscreen-chat-styles');
      if (styleTagEl && !document.querySelector('.fullscreen-chat-open')) {
        styleTagEl.remove();
      }
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  const handleSendWithOpen = () => {
    sendMessage();
    if (!isChatOpen) {
      openChat();
    }
  };

  const handleSendText = (text: string) => {
    sendMessage(text);
    if (!isChatOpen) {
      openChat();
    }
  };

  const handleContinue = () => {
    if (!isChatOpen) {
      openChat();
    }
  };

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
          chatStyle={chatStyle}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onClose={closeChat}
        />
      )}
    </div>
  );
};
