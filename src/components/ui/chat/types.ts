import React from 'react';
import { InteractivePayload, Message, AgentConfig, DebugTrace, ChatHistoryItem } from 'types';

export interface PendingInteractive {
  /** id сообщения ассистента, к которому относится подсказка. */
  messageId: string;
  payload: InteractivePayload;
}

// Часто меняющиеся данные
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  isChatOpen: boolean;
  isFullscreen: boolean;
  threadId?: string | null;
  pendingInteractive: PendingInteractive | null;
}

// Стабильные колбэки + конфигурация
export interface ChatActions {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInputValue: (value: string) => void;
  sendMessage: (customText?: string) => void;
  sendInteractive: (assistantMessageId: string, text: string, extraContext?: Record<string, any>) => Promise<void>;
  clearChat: () => void;
  newChat: () => void;
  retryMessage?: (messageId: string) => void;
  selectedAgent: AgentConfig | null;
  setSelectedAgent: (agent: AgentConfig) => void;
  agents: AgentConfig[];
  openChat: () => void;
  closeChat: () => void;
  toggleFullscreen: () => void;
  inputContainerRef: React.RefObject<HTMLDivElement>;
  chatMessagesRef: React.RefObject<HTMLDivElement>;
  floatingChatRef: React.RefObject<HTMLDivElement>;
  setFloatingChatRefCallback: (node: HTMLDivElement | null) => void;
  chatStyle: React.CSSProperties;
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
  exportChat: () => void;
  handleSuggestionClick: (suggestion: string) => void;
  debug: boolean;
  getTrace?: (messageId: string) => DebugTrace | undefined;
  testMessageButton?: boolean;
  fetchThreads: () => Promise<ChatHistoryItem[]>;
  loadThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<boolean | null>;
}

export interface ChatConfig extends ChatState, ChatActions {}

export interface ChatProviderProps {
  children: React.ReactNode;
  agents: AgentConfig[];
  placeholderText?: string;
  suggestions?: string;
  suggestionsPlacement?: 'always' | 'onFocus';
  showSuggestions?: boolean;
  suggestionsAppendToAll?: boolean;
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
  testMessageButton?: boolean;
}
