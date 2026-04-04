import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Message, AgentConfig, DebugTrace } from 'types';
import { useGrafanaUser } from 'components/hooks/useGrafanaUser';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatOpen } from '../hooks/useChatOpen';
import { useChatPosition } from '../hooks/useChatPosition';
import { useChatWheelHandler } from '../hooks/useChatWheelHandler';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DEFAULT_PLACEHOLDER } from './config';

export interface ChatConfig {
  // Состояния
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: (customText?: string) => void;
  clearChat: () => void;
  newChat: () => void;
  retryMessage?: (messageId: string) => void;

  // Агенты
  selectedAgent: AgentConfig | null;
  setSelectedAgent: (agent: AgentConfig) => void;
  agents: AgentConfig[];

  // UI состояние
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;

  // Refs и стили
  inputContainerRef: React.RefObject<HTMLDivElement>;
  chatMessagesRef: React.RefObject<HTMLDivElement>;
  floatingChatRef: React.RefObject<HTMLDivElement>;
  setFloatingChatRefCallback: (node: HTMLDivElement | null) => void;
  chatStyle: React.CSSProperties;

  // Опции панели
  placeholderText: string;
  maxWidth?: number;
  centerInput?: boolean;
  buttonText?: string;
  openFullscreen?: boolean;
  centerFloatingChat?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  suggestions?: string[];
  suggestionsPlacement?: 'always' | 'onFocus';
  showSuggestions?: boolean;

  // Действия
  exportChat: () => void;
  openSettings: () => void;
  handleSuggestionClick: (suggestion: string) => void;

  debug: boolean;
  getTrace?: (messageId: string) => DebugTrace | undefined;
}

interface ChatProviderProps {
  children: React.ReactNode;
  agents: AgentConfig[];
  placeholderText?: string;
  suggestions?: string;
  suggestionsPlacement?: 'always' | 'onFocus';
  showSuggestions?: boolean;
  maxWidth?: number;
  centerInput?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  debug?: boolean;
  buttonText?: string;
  openFullscreen?: boolean;
  centerFloatingChat?: boolean;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  agents,
  placeholderText = DEFAULT_PLACEHOLDER,
  suggestions = '',
  suggestionsPlacement = 'always',
  showSuggestions = false,
  maxWidth,
  centerInput,
  welcomeMessage,
  showWelcomeMessage = false,
  debug = false,
  buttonText = 'Open Chat',
  openFullscreen = false,
  centerFloatingChat = false,
}) => {
  // User
  const { user } = useGrafanaUser();

  // Agent selection
  const defaultAgent = useMemo(() => agents.find((a) => a.default) || null, [agents]);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(defaultAgent);

  // Messages
  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage: sendMessageRaw,
    clearChat,
    newChat,
    retryMessage,
    getTrace,
  } = useChatMessages(selectedAgent, user, debug);

  // UI state
  const { isChatOpen, openChat, closeChat } = useChatOpen();

  const { inputContainerRef, chatMessagesRef, floatingChatRef, setFloatingChatRefCallback, chatStyle, chatDomElement } =
    useChatPosition(isChatOpen);
  
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
      if (styleTagEl && !document.querySelector('.fullscreen-chat-open')) {
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

  const openSettings = useCallback(() => {
    console.log('Open settings – implement as needed');
  }, []);

  const value: ChatConfig = {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
    retryMessage,
    selectedAgent,
    setSelectedAgent,
    agents,
    isChatOpen,
    openChat,
    closeChat,
    isFullscreen,
    toggleFullscreen,
    inputContainerRef,
    chatMessagesRef,
    floatingChatRef,
    setFloatingChatRefCallback,
    chatStyle,
    placeholderText,
    maxWidth,
    centerInput,
    welcomeMessage,
    showWelcomeMessage,
    suggestions: suggestionsArray,
    suggestionsPlacement,
    showSuggestions,
    exportChat,
    openSettings,
    handleSuggestionClick,
    debug,
    getTrace,
    buttonText,
    openFullscreen,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

const ChatContext = createContext<ChatConfig | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
