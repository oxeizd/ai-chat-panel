import React from 'react';
import { Message, AgentConfig, DebugTrace } from 'types';

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
  fullScale?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  suggestions?: string[];
  suggestionsPlacement?: 'always' | 'onFocus';
  showSuggestions?: boolean;
  inputAreaBackground?: boolean;
  panelHeigth?: number;
  panelWidth?: number;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  // Действия
  exportChat: () => void;
  handleSuggestionClick: (suggestion: string) => void;

  debug: boolean;
  getTrace?: (messageId: string) => DebugTrace | undefined;
}

export interface ChatProviderProps {
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
  inputAreaBackground?: boolean;
  fullScale?: boolean;
}
