import React, { useLayoutEffect, useCallback, useState } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './styles';
import { InputArea } from './InputArea';
import { FloatingChat } from './FloatingChat';
import { useChatOpen } from './hooks/useChatOpen';
import { useChatPosition } from './hooks/useChatPosition';
import { useChatWheelHandler } from './hooks/useChatWheelHandler';
import { AgentConfig, Message } from 'types';

interface FloatingChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: () => void;
  clearChat: () => void;
  newChat: () => void;
  selectedAgent: AgentConfig;
  setSelectedAgent: (agent: AgentConfig) => void;
  exportChat: () => void;
  openSettings: () => void;
  placeholderText: string;
  agents: AgentConfig[];
  maxWidth?: number;
  centerInput?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  suggestions?: string[];
  suggestionsPlacement?: 'always' | 'onFocus';
}

export const FloatingChatPanel: React.FC<FloatingChatPanelProps> = ({
  messages,
  isLoading,
  inputValue,
  setInputValue,
  sendMessage,
  clearChat,
  newChat,
  selectedAgent,
  setSelectedAgent,
  exportChat,
  openSettings,
  placeholderText,
  agents,
  maxWidth,
  centerInput,
  welcomeMessage,
  showWelcomeMessage,
  suggestions,
  suggestionsPlacement,
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const { isChatOpen, openChat, closeChat } = useChatOpen();
  const { inputContainerRef, chatMessagesRef, floatingChatRef, chatStyle } = useChatPosition(isChatOpen, messages);
  useChatWheelHandler(isChatOpen, floatingChatRef);

  const [inputFocused, setInputFocused] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.currentTarget.value), [setInputValue]);
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      if (!isChatOpen) {
        openChat();
      }
    }
  }, [sendMessage, isChatOpen, openChat]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value), [setInputValue]);
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);
  const handleTextareaWheel = useCallback((e: React.WheelEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight;
    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
      e.preventDefault();
    }
  }, []);

  const handleSendWithOpen = useCallback(() => {
    sendMessage();
    if (!isChatOpen) {
      openChat();
    }
  }, [sendMessage, isChatOpen, openChat]);

  const handleInputFocus = useCallback(() => setInputFocused(true), []);
  const handleInputBlur = useCallback(() => setInputFocused(false), []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    sendMessage();
  }, [setInputValue, sendMessage]);

  useLayoutEffect(() => {
    if (isChatOpen && chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, chatMessagesRef]);

  const wrapperStyle = cx(
    styles.normalWrapper,
    maxWidth && maxWidth > 0 ? styles.withMaxWidth(maxWidth) : undefined,
    centerInput && !isChatOpen && styles.verticalCentered
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
        className={cx(isChatOpen && styles.inputContainerHidden)}
        placeholderText={placeholderText}
        agents={agents}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        centerInput={centerInput}
        suggestions={suggestions}
        suggestionsPlacement={suggestionsPlacement}
        inputFocused={inputFocused}
        welcomeMessage={welcomeMessage}
        showWelcomeMessage={showWelcomeMessage}
        onSuggestionClick={handleSuggestionClick}
      />
      {isChatOpen && (
        <FloatingChat
          chatStyle={chatStyle}
          messages={messages}
          isLoading={isLoading}
          inputValue={inputValue}
          onInputChange={handleTextareaChange}
          onKeyDown={handleTextareaKeyDown}
          onWheel={handleTextareaWheel}
          onSend={sendMessage}
          onClose={closeChat}
          onClearChat={clearChat}
          onExportChat={exportChat}
          onOpenSettings={openSettings}
          onNewChat={newChat}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          chatMessagesRef={chatMessagesRef}
          floatingChatRef={floatingChatRef}
          placeholderText={placeholderText}
          agents={agents}
          maxWidth={maxWidth}
          welcomeMessage={welcomeMessage}
          showWelcomeMessage={showWelcomeMessage}
          suggestions={suggestions}
          suggestionsPlacement={suggestionsPlacement}
          inputFocused={inputFocused}
          setInputFocused={setInputFocused}
          onSuggestionClick={handleSuggestionClick}
        />
      )}
    </div>
  );
};