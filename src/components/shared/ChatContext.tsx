import React, { createContext, useContext } from 'react';
import { Message, AgentConfig } from 'types';

export interface ChatConfig {
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
  showSuggestions?: boolean;
}

const ChatContext = createContext<ChatConfig | null>(null);

export const ChatProvider: React.FC<{ value: ChatConfig; children: React.ReactNode }> = ({ value, children }) => {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};