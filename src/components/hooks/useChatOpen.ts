// hooks/useChatOpen.ts
import { useState, useEffect } from 'react';

export const useChatOpen = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (isChatOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isChatOpen]);

  const closeChat = () => setIsChatOpen(false);
  const openChat = () => setIsChatOpen(true);

  return { isChatOpen, openChat, closeChat };
};
