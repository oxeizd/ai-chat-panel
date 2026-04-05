import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { CHAT_SETTINGS } from '../core/config';

export const useChatPosition = (isChatOpen: boolean, centerChat: boolean, maxWidth = 450) => {
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const floatingChatRef = useRef<HTMLDivElement | null>(null);
  const [chatDomElement, setChatDomElement] = useState<HTMLElement | null>(null);
  const [chatStyle, setChatStyle] = useState<React.CSSProperties>({
    left: 0,
    top: undefined,
    bottom: undefined,
    maxHeight: CHAT_SETTINGS.minHeight,
    width: 0,
  });

  const setFloatingChatRefCallback = useCallback((node: HTMLDivElement | null) => {
    floatingChatRef.current = node;
    setChatDomElement(node);
  }, []);

  const updateChatPosition = useCallback(() => {
    if (centerChat) {
      const viewportHeight = window.innerHeight;
      const maxHeightPx = Math.floor(viewportHeight * 0.8);

      const contentHeight = chatMessagesRef.current?.scrollHeight || 0;
      const desiredHeight = contentHeight + CHAT_SETTINGS.inputWrapperHeight;
      const actualHeightPx = Math.min(maxHeightPx, Math.max(CHAT_SETTINGS.minHeight, desiredHeight));

      setChatStyle({
        position: 'fixed',
        left: `calc(50% - ${Math.floor(maxWidth / 2)}px)`,
        top: `calc(50% - ${Math.floor(actualHeightPx / 2)}px + 24px)`,
        width: maxWidth,
        maxHeight: `${maxHeightPx}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: CHAT_SETTINGS.default_padding,
      });
      return;
    }

    if (!inputContainerRef.current || !isChatOpen) {
      return;
    }

    const rect = inputContainerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const { margin, positionOffset, minHeight, viewportLimit } = CHAT_SETTINGS;
    const contentHeight = chatMessagesRef.current?.scrollHeight || 0;
    const requiredHeight = contentHeight + CHAT_SETTINGS.inputWrapperHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const availableBelow = Math.max(0, Math.min(spaceBelow - margin, viewportHeight * viewportLimit));
    const availableAbove = Math.max(0, Math.min(spaceAbove - margin, viewportHeight * viewportLimit));

    let preferDown: boolean;
    const canFitRequiredBelow = availableBelow >= requiredHeight;
    const canFitRequiredAbove = availableAbove >= requiredHeight;

    if (canFitRequiredBelow && canFitRequiredAbove) {
      preferDown = availableBelow >= availableAbove;
    } else if (canFitRequiredBelow) {
      preferDown = true;
    } else if (canFitRequiredAbove) {
      preferDown = false;
    } else {
      preferDown = availableBelow >= availableAbove;
    }

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight: number;

    if (preferDown) {
      top = rect.bottom + margin - positionOffset;
      maxHeight = Math.max(minHeight, Math.min(requiredHeight, availableBelow));
    } else {
      bottom = viewportHeight - rect.top + margin - positionOffset;
      maxHeight = Math.max(minHeight, Math.min(requiredHeight, availableAbove));
    }

    setChatStyle({
      position: 'fixed',
      left: rect.left,
      top,
      bottom,
      maxHeight,
      width: rect.width,
      padding: CHAT_SETTINGS.default_padding,
    });
  }, [isChatOpen, centerChat, maxWidth]);

  useLayoutEffect(() => {
    if (!isChatOpen) {
      return;
    }
    const frame = requestAnimationFrame(() => updateChatPosition());
    const handleResizeOrScroll = () => requestAnimationFrame(updateChatPosition);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll);

    let inputResizeObserver: ResizeObserver | null = null;
    if (!centerChat && inputContainerRef.current && window.ResizeObserver) {
      inputResizeObserver = new ResizeObserver(updateChatPosition);
      inputResizeObserver.observe(inputContainerRef.current);
    }

    let chatMessagesResizeObserver: ResizeObserver | null = null;
    if (chatMessagesRef.current && window.ResizeObserver) {
      chatMessagesResizeObserver = new ResizeObserver(updateChatPosition);
      chatMessagesResizeObserver.observe(chatMessagesRef.current);
    }

    let floatingResizeObserver: ResizeObserver | null = null;
    if (floatingChatRef.current && window.ResizeObserver) {
      floatingResizeObserver = new ResizeObserver(updateChatPosition);
      floatingResizeObserver.observe(floatingChatRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
      inputResizeObserver?.disconnect();
      chatMessagesResizeObserver?.disconnect();
      floatingResizeObserver?.disconnect();
    };
  }, [isChatOpen, centerChat, updateChatPosition]);

  return {
    inputContainerRef,
    chatMessagesRef,
    floatingChatRef,
    setFloatingChatRefCallback,
    chatStyle,
    chatDomElement,
  };
};
