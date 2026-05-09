import { createContext, useContext } from 'react';
import { ChatState, ChatActions } from './types';

// Часто меняющиеся данные
export const ChatStateContext = createContext<ChatState | null>(null);
// Стабильные колбэки и конфигурация
export const ChatActionsContext = createContext<ChatActions | null>(null);

export const useChatState = () => {
  const ctx = useContext(ChatStateContext);
  if (!ctx) {
    throw new Error('useChatState must be used within ChatProvider');
  }
  return ctx;
};

export const useChatActions = () => {
  const ctx = useContext(ChatActionsContext);
  if (!ctx) {
    throw new Error('useChatActions must be used within ChatProvider');
  }
  return ctx;
};

// Оставлен для обратной совместимости, но лучше использовать раздельные хуки
export const useChat = () => ({
  ...useChatState(),
  ...useChatActions(),
});
