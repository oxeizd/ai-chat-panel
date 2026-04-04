import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatStyle } from 'types';
import { CHAT_SETTINGS } from '../core/config';

export const useChatPosition = (isChatOpen: boolean) => {
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const floatingChatRef = useRef<HTMLDivElement | null>(null);
  const [chatDomElement, setChatDomElement] = useState<HTMLElement | null>(null);
  const [chatStyle, setChatStyle] = useState<ChatStyle>({
    left: 0,
    top: undefined,
    bottom: undefined,
    maxHeight: CHAT_SETTINGS.minHeight,
    width: 0,
  });

  // Callback ref для установки и синхронизации с DOM-элементом
  const setFloatingChatRefCallback = useCallback((node: HTMLDivElement | null) => {
    floatingChatRef.current = node;
    setChatDomElement(node);
  }, []);

  const updateChatPosition = useCallback(() => {
    if (!inputContainerRef.current || !isChatOpen) {
      return;
    }

    const rect = inputContainerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const { margin, positionOffset, targetHeight, minHeight, viewportLimit, inputWrapperHeight } = CHAT_SETTINGS;

    const contentHeight = chatMessagesRef.current?.scrollHeight || 0;
    const requiredHeight = contentHeight + inputWrapperHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const availableBelow = Math.max(0, Math.min(spaceBelow - margin, viewportHeight * viewportLimit));
    const availableAbove = Math.max(0, Math.min(spaceAbove - margin, viewportHeight * viewportLimit));

    const canFitTargetBelow = availableBelow >= targetHeight;
    const canFitTargetAbove = availableAbove >= targetHeight;
    const canFitMinBelow = availableBelow >= minHeight;
    const canFitMinAbove = availableAbove >= minHeight;

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight: number;

    const isCurrentlyDown = chatStyle.top !== undefined;
    const shouldSwitch =
      (isCurrentlyDown && !canFitMinBelow && canFitMinAbove) || (!isCurrentlyDown && !canFitMinAbove && canFitMinBelow);

    if (isCurrentlyDown && !shouldSwitch) {
      top = rect.bottom + margin - positionOffset;
      maxHeight = Math.max(minHeight, Math.min(requiredHeight, availableBelow, viewportHeight * viewportLimit));
    } else if (!isCurrentlyDown && !shouldSwitch) {
      bottom = viewportHeight - rect.top + margin - positionOffset;
      maxHeight = Math.max(minHeight, Math.min(requiredHeight, availableAbove, viewportHeight * viewportLimit));
    } else if (canFitTargetBelow || canFitTargetAbove) {
      top = rect.bottom + margin - positionOffset;
      maxHeight = targetHeight;
    } else if (canFitMinBelow && canFitMinAbove) {
      if (availableBelow >= availableAbove) {
        top = rect.bottom + margin - positionOffset;
        maxHeight = availableBelow;
      } else {
        bottom = viewportHeight - rect.top + margin - positionOffset;
        maxHeight = availableAbove;
      }
    } else if (canFitMinBelow) {
      top = rect.bottom + margin - positionOffset;
      maxHeight = availableBelow;
    } else if (canFitMinAbove) {
      bottom = viewportHeight - rect.top + margin - positionOffset;
      maxHeight = availableAbove;
    } else {
      if (availableBelow > availableAbove) {
        top = rect.bottom + margin - positionOffset;
        maxHeight = Math.max(100, availableBelow);
      } else {
        bottom = viewportHeight - rect.top + margin - positionOffset;
        maxHeight = Math.max(100, availableAbove);
      }
    }

    setChatStyle({
      left: rect.left,
      top,
      bottom,
      maxHeight: Math.max(minHeight, maxHeight),
      width: rect.width,
      padding: CHAT_SETTINGS.default_padding,
    });
  }, [isChatOpen, chatStyle.top]);

  useEffect(() => {
    if (!isChatOpen) {
      return;
    }
    updateChatPosition();

    const handleResizeOrScroll = () => requestAnimationFrame(updateChatPosition);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll);

    let inputResizeObserver: ResizeObserver | null = null;
    if (inputContainerRef.current && window.ResizeObserver) {
      inputResizeObserver = new ResizeObserver(updateChatPosition);
      inputResizeObserver.observe(inputContainerRef.current);
    }

    let chatResizeObserver: ResizeObserver | null = null;
    if (floatingChatRef.current && window.ResizeObserver) {
      chatResizeObserver = new ResizeObserver(updateChatPosition);
      chatResizeObserver.observe(floatingChatRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
      inputResizeObserver?.disconnect();
      chatResizeObserver?.disconnect();
    };
  }, [isChatOpen, updateChatPosition]);

  return {
    inputContainerRef,
    chatMessagesRef,
    floatingChatRef, // оставляем для чтения, если нужно
    setFloatingChatRefCallback, // новая функция для установки
    chatStyle,
    chatDomElement, // если нужно где-то ещё
  };
};
