import React, { useLayoutEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './ChatPanel.styles';
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
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const { isChatOpen, openChat, closeChat } = useChatOpen();
  const { inputContainerRef, chatMessagesRef, floatingChatRef, chatStyle } = useChatPosition(isChatOpen, messages);
  useChatWheelHandler(isChatOpen, floatingChatRef);

  // Обработчики событий для InputArea (input) – используем onKeyDown
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.currentTarget.value);
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      if (!isChatOpen) {
        openChat();
      }
    }
  };

  // Обработчики для textarea в FloatingChat
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value);
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const handleTextareaWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight;
    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
      e.preventDefault();
    }
  };

  useLayoutEffect(() => {
    if (isChatOpen && chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, chatMessagesRef]);

  return (
    <>
      <div className={styles.normalWrapper}>
        <InputArea
          ref={inputContainerRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown} // ← исправлено: onKeyDown
          onSend={() => {
            sendMessage();
            if (!isChatOpen) {
              openChat();
            }
          }}
          isLoading={isLoading}
          onClearChat={clearChat}
          onExportChat={exportChat}
          onOpenSettings={openSettings}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          className={cx(isChatOpen && styles.inputContainerHidden)}
          placeholderText={placeholderText}
          agents={agents}
        />
      </div>
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
        />
      )}
    </>
  );
};
