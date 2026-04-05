import { useState } from 'react';

/**
 * Manages the open/closed state of the floating chat.
 *
 * NOTE: We intentionally do NOT lock document.body.overflow here.
 * The floating chat is rendered in a portal and scroll-isolation is
 * handled by useChatWheelHandler — which prevents wheel events from
 * bubbling out of the chat area to the page, without locking the
 * entire document when the mouse is outside the chat.
 */
export const useChatOpen = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);

  return { isChatOpen, openChat, closeChat };
};
