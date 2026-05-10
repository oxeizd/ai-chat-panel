import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AgentConfig } from 'types';
import { useGrafanaUser } from 'components/hooks/useGrafanaUser';
import { useChatMessages } from '../messages/hooks/useChatMessages';
import { useChatOpen } from '../hooks/useChatOpen';
import { useChatPosition } from '../hooks/useChatPosition';
import { useChatWheelHandler } from '../hooks/useChatWheelHandler';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DEFAULT_PLACEHOLDER } from './config';
import { ChatActions, ChatProviderProps, ChatState } from './types';
import { ChatActionsContext, ChatStateContext } from './ChatContext';

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  agents,
  placeholderText = DEFAULT_PLACEHOLDER,
  suggestions = '',
  suggestionsPlacement = 'always',
  showSuggestions = false,
  maxWidth,
  centerInput = false,
  welcomeMessage,
  showWelcomeMessage = false,
  debug = false,
  buttonText = 'Open Chat',
  openFullscreen = false,
  centerFloatingChat = false,
  inputAreaBackground = false,
  fullScale = false,
}) => {
  const { user } = useGrafanaUser();

  if (placeholderText.length === 0) {
    placeholderText = DEFAULT_PLACEHOLDER;
  }

  // Agent selection
  const defaultAgent = useMemo(() => agents.find((a) => a.default) || null, [agents]);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(defaultAgent);

  // Messages
  const {
    messages,
    setMessages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage: sendMessageRaw,
    clearChat,
    newChat,
    retryMessage,
    getTrace,
    threadId,
  } = useChatMessages(selectedAgent, user, debug);

  useEffect(() => {
    newChat();
  }, [selectedAgent, newChat]);

  // UI state
  const { isChatOpen, openChat, closeChat } = useChatOpen();

  const { inputContainerRef, chatMessagesRef, floatingChatRef, setFloatingChatRefCallback, chatStyle, chatDomElement } =
    useChatPosition(isChatOpen, centerFloatingChat, fullScale, maxWidth);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

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
      if (styleTagEl && document.body.classList.contains('fullscreen-chat-open')) {
        styleTagEl.remove();
      }
    };
  }, [isFullscreen]);

  useChatWheelHandler(isChatOpen, chatDomElement);
  useAutoScroll(chatMessagesRef, [messages, isChatOpen]);

  // Send message wrapper
  const sendMessage = useCallback(
    (customText?: string) => {
      const textToSend = customText !== undefined ? customText : inputValue;
      if (textToSend.trim()) {
        sendMessageRaw(textToSend);
        if (customText === undefined) {
          setInputValue('');
        }
        if (!isChatOpen) {
          openChat();
        }
      }
    },
    [inputValue, sendMessageRaw, setInputValue, isChatOpen, openChat]
  );

  // Suggestions
  const suggestionsArray = useMemo(() => {
    return suggestions
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [suggestions]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage]
  );

  // Menu actions
  const exportChat = useCallback(() => {
    const content = messages.map((m) => `${m.sender}: ${m.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const stateValue = useMemo<ChatState>(
    () => ({
      messages,
      isLoading,
      inputValue,
      isChatOpen,
      isFullscreen,
      threadId,
    }),
    [messages, isLoading, inputValue, isChatOpen, isFullscreen, threadId]
  );

  const actionsValue = useMemo<ChatActions>(
    () => ({
      setMessages,
      setInputValue,
      sendMessage,
      clearChat,
      newChat,
      retryMessage,
      selectedAgent,
      setSelectedAgent,
      agents,
      openChat,
      closeChat,
      toggleFullscreen,
      inputContainerRef,
      chatMessagesRef,
      floatingChatRef,
      setFloatingChatRefCallback,
      chatStyle,
      placeholderText,
      maxWidth,
      centerInput,
      buttonText,
      openFullscreen,
      centerFloatingChat,
      fullScale,
      welcomeMessage,
      showWelcomeMessage,
      suggestions: suggestionsArray,
      suggestionsPlacement,
      showSuggestions,
      inputAreaBackground,
      exportChat,
      handleSuggestionClick,
      debug,
      getTrace,
    }),
    [
      setMessages,
      setInputValue,
      sendMessage,
      clearChat,
      newChat,
      retryMessage,
      selectedAgent,
      setSelectedAgent,
      agents,
      openChat,
      closeChat,
      toggleFullscreen,
      inputContainerRef,
      chatMessagesRef,
      floatingChatRef,
      setFloatingChatRefCallback,
      chatStyle,
      placeholderText,
      maxWidth,
      centerInput,
      buttonText,
      openFullscreen,
      centerFloatingChat,
      fullScale,
      welcomeMessage,
      showWelcomeMessage,
      suggestionsArray,
      suggestionsPlacement,
      showSuggestions,
      inputAreaBackground,
      exportChat,
      handleSuggestionClick,
      debug,
      getTrace,
    ]
  );

  return (
    <ChatStateContext.Provider value={stateValue}>
      <ChatActionsContext.Provider value={actionsValue}>{children}</ChatActionsContext.Provider>
    </ChatStateContext.Provider>
  );
};
