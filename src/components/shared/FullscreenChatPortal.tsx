import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FloatingChat } from '../FloatingChat';
import { useChat } from '../shared/ChatContext';

interface FullscreenChatPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenChatPortal: React.FC<FullscreenChatPortalProps> = ({ isOpen, onClose }) => {
  const props = useChat(); // получаем данные из контекста

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('fullscreen-chat-open');
      // Динамически добавляем стили (если ещё не добавлены)
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
    } else {
      document.body.classList.remove('fullscreen-chat-open');
    }
    return () => {
      document.body.classList.remove('fullscreen-chat-open');
      // Не удаляем стили, чтобы не создавать их повторно при следующем открытии
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
    />,
    document.body
  );
};