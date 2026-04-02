// components/FloatingChatPanel.tsx
import React, { useCallback, useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from './styles';
import { InputArea } from './InputArea';
import { FloatingChat } from './FloatingChat';
import { useChatOpen } from './hooks/useChatOpen';
import { useChatPosition } from './hooks/useChatPosition';
import { useChatWheelHandler } from './hooks/useChatWheelHandler';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useChat } from './shared/ChatContext';

export const FloatingChatPanel: React.FC = () => {
  const props = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);

  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    exportChat,
    openSettings,
    selectedAgent,
    setSelectedAgent,
    placeholderText,
    agents,
    maxWidth,
    centerInput,
    welcomeMessage,
    showWelcomeMessage,
    suggestions,
    suggestionsPlacement,
    showSuggestions,
  } = props;

  const { isChatOpen, openChat, closeChat } = useChatOpen();
  const { inputContainerRef, chatMessagesRef, floatingChatRef, chatStyle } = useChatPosition(isChatOpen, messages);

  const [chatDomElement, setChatDomElement] = useState<HTMLElement | null>(null);
  const setFloatingChatRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      // Синхронизируем ref из useChatPosition с реальным DOM-элементом
      if (floatingChatRef && 'current' in floatingChatRef) {
        // eslint-disable-next-line react-hooks/immutability
        (floatingChatRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
      setChatDomElement(node);
    },
    [floatingChatRef]
  );

  useChatWheelHandler(isChatOpen, chatDomElement);
  useAutoScroll(chatMessagesRef, [messages, isChatOpen]);

  const [inputFocused, setInputFocused] = useState(false);
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

  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.currentTarget.value),
    [setInputValue]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        if (!isChatOpen) {
          openChat();
        }
      }
    },
    [sendMessage, isChatOpen, openChat]
  );

  const handleSendWithOpen = useCallback(() => {
    sendMessage();
    if (!isChatOpen) {
      openChat();
    }
  }, [sendMessage, isChatOpen, openChat]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setInputValue(suggestion);
      sendMessage();
    },
    [setInputValue, sendMessage]
  );

  const hideSuggestions = isChatOpen || messages.length > 0;

  const wrapperStyle = cx(
    styles.base.normalWrapper,
    maxWidth && maxWidth > 0 ? styles.base.withMaxWidth(maxWidth) : undefined,
    centerInput && !isChatOpen && styles.base.verticalCentered
  );

  return (
    <div className={wrapperStyle}>
      <InputArea
        ref={inputContainerRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onSend={handleSendWithOpen}
        isLoading={isLoading}
        onClearChat={clearChat}
        onExportChat={exportChat}
        onOpenSettings={openSettings}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        className={cx(isChatOpen && styles.input.containerHidden)}
        placeholderText={placeholderText}
        agents={agents}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        centerInput={centerInput}
        suggestions={suggestions}
        suggestionsPlacement={suggestionsPlacement}
        inputFocused={inputFocused}
        welcomeMessage={welcomeMessage}
        showWelcomeMessage={showWelcomeMessage}
        onSuggestionClick={handleSuggestionClick}
        hideSuggestions={hideSuggestions}
        showSuggestions={showSuggestions}
      />
      {isChatOpen && (
        <FloatingChat
          ref={setFloatingChatRefCallback}
          messagesContainerRef={chatMessagesRef}
          chatStyle={chatStyle}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onClose={closeChat}
          maxWidth={maxWidth}
        />
      )}
    </div>
  );
};
