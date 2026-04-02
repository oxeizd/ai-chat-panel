// components/FloatingChatPanel.tsx
import React, { useCallback, useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './styles';
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
  const styles = getStyles(theme);

  const { isChatOpen, openChat, closeChat } = useChatOpen();
  const { inputContainerRef, chatMessagesRef, floatingChatRef, chatStyle } = useChatPosition(isChatOpen, props.messages);
  useChatWheelHandler(isChatOpen, floatingChatRef);
  useAutoScroll(chatMessagesRef, [props.messages, isChatOpen]);

  const [inputFocused, setInputFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => props.setInputValue(e.currentTarget.value), []);
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.sendMessage();
      if (!isChatOpen) openChat();
    }
  }, [props.sendMessage, isChatOpen, openChat]);

  const handleSendWithOpen = useCallback(() => {
    props.sendMessage();
    if (!isChatOpen) openChat();
  }, [props.sendMessage, isChatOpen, openChat]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    props.setInputValue(suggestion);
    props.sendMessage();
  }, []);

  const hideSuggestions = isChatOpen || props.messages.length > 0;

  const wrapperStyle = cx(
    styles.base.normalWrapper,
    props.maxWidth && props.maxWidth > 0 ? styles.base.withMaxWidth(props.maxWidth) : undefined,
    props.centerInput && !isChatOpen && styles.base.verticalCentered
  );

  return (
    <div className={wrapperStyle}>
      <InputArea
        ref={inputContainerRef}
        value={props.inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onSend={handleSendWithOpen}
        isLoading={props.isLoading}
        onClearChat={props.clearChat}
        onExportChat={props.exportChat}
        onOpenSettings={props.openSettings}
        selectedAgent={props.selectedAgent}
        setSelectedAgent={props.setSelectedAgent}
        className={cx(isChatOpen && styles.input.containerHidden)}
        placeholderText={props.placeholderText}
        agents={props.agents}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        centerInput={props.centerInput}
        suggestions={props.suggestions}
        suggestionsPlacement={props.suggestionsPlacement}
        inputFocused={inputFocused}
        welcomeMessage={props.welcomeMessage}
        showWelcomeMessage={props.showWelcomeMessage}
        onSuggestionClick={handleSuggestionClick}
        hideSuggestions={hideSuggestions}
        showSuggestions={props.showSuggestions}
      />
        {isChatOpen && (
          <FloatingChat
            chatStyle={chatStyle}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onClose={closeChat}
            maxWidth={props.maxWidth} 
          />
        )}
    </div>
  );
};