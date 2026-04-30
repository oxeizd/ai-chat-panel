import { createContext, useContext } from 'react';
import { ChatConfig } from './types';

export const ChatContext = createContext<ChatConfig | null>(null);

export const useChat = (): ChatConfig => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
