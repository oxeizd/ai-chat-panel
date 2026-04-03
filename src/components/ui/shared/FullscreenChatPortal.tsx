import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FloatingChat } from '../chat/FloatingChat';
import { useChat } from 'components/ui/core/ChatConfig';

interface FullscreenChatPortalProps {
  isOpen: boolean;
  onClose: () => void;
  messagesContainerRef?: React.RefObject<HTMLDivElement>;
}

export const FullscreenChatPortal: React.FC<FullscreenChatPortalProps> = ({
  isOpen,
  onClose,
  messagesContainerRef,
}) => {
  const props = useChat();

  useEffect(() => {
    if (!isOpen) {
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
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const fullscreenStyle = {
    left: 0,
    top: 0,
    bottom: 0,
    maxHeight: window.innerHeight,
    width: window.innerWidth,
  };

  return ReactDOM.createPortal(
    <FloatingChat
      chatStyle={fullscreenStyle}
      onClose={onClose}
      isFullscreen={true}
      onToggleFullscreen={onClose}
      maxWidth={props.maxWidth}
      messagesContainerRef={messagesContainerRef}
    />,
    document.body
  );
};
