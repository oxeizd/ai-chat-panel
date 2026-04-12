import { useState, useRef, useLayoutEffect, useCallback } from 'react';

type ChatStyle = React.CSSProperties;

const SETTINGS = {
  margin: 8,
  topOffset: 100,
  minHeight: 500,
  minWrapperHeight: 150,
  contentLimit: 0.96,
  padding: 16,
};

export const useChatPosition = (isChatOpen: boolean, centerChat: boolean, maxWidth = 1300) => {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [chatDomElement, setChatDomElement] = useState<HTMLElement | null>(null);

  const [chatStyle, setChatStyle] = useState<ChatStyle>({
    left: 0,
    top: undefined,
    bottom: undefined,
    maxHeight: SETTINGS.minHeight,
    width: 0,
  });

  const setFloatingChatRefCallback = useCallback((node: HTMLDivElement | null) => {
    chatRef.current = node;
    setChatDomElement(node);
  }, []);

  const updateChatPosition = useCallback(() => {
    const { margin, topOffset, minHeight, minWrapperHeight, contentLimit, padding } = SETTINGS;

    const chatHeight = chatRef.current?.offsetHeight;
    const messagesHeight = (messagesRef.current?.scrollHeight || 0) + minWrapperHeight;
    const targetHeight = chatHeight ?? messagesHeight;

    if (centerChat) {
      const maxHeight = Math.floor((window.innerHeight - topOffset) * 0.96);
      const height = Math.min(maxHeight, Math.max(minHeight, targetHeight));

      let top;

      if (window.innerHeight / 2 - Math.floor(height / 2) < topOffset) {
        top = `${topOffset}px`;
      } else {
        top = `calc(50% - ${Math.floor(height / 2)}px)`;
      }

      let width: number;

      if (typeof maxWidth !== 'number' || maxWidth <= 0) {
        width = 1300;
      } else {
        width = maxWidth;
      }

      if (window.innerWidth < width) {
        width = Math.round(window.innerWidth * 0.8);
      }

      setChatStyle({
        position: 'fixed',
        left: `calc(50% - ${Math.floor(width / 2)}px)`,
        top: top,
        width: width,
        maxHeight: `${maxHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: padding,
      });

      return;
    }

    if (!inputRef.current || !isChatOpen) {
      return;
    }

    const rect = inputRef.current.getBoundingClientRect();

    const top = Math.max(topOffset, rect.top);
    const bottom = window.innerHeight - rect.bottom + margin;
    const freerTop = Math.max(0, top - topOffset);
    const freeBottom = Math.max(0, (window.innerHeight - top + margin) * contentLimit);

    const showAbove = freerTop >= targetHeight;
    const showBelow = freeBottom >= targetHeight;
    const preferDown = showBelow ? !showAbove || freeBottom >= freerTop : freeBottom >= freerTop;

    let topPosition: number | undefined;
    let bottomPosition: number | undefined;
    let maxHeightValue: number | undefined;

    if (preferDown) {
      topPosition = top;
      maxHeightValue = freeBottom;
      bottomPosition = undefined;
    } else {
      topPosition = undefined;
      maxHeightValue = window.innerHeight - bottom - topOffset;
      bottomPosition = bottom;
    }

    let leftPosition: number | undefined;
    let widthPosition: number | undefined;

    const sidePadding = 12;
    if (maxWidth > rect.width) {
      widthPosition = maxWidth;
      let desiredLeft = rect.right - widthPosition;
      leftPosition = Math.max(sidePadding, Math.min(desiredLeft, window.innerWidth - widthPosition - sidePadding));
    } else {
      leftPosition = rect.left;
      widthPosition = rect.width;
    }

    setChatStyle({
      position: 'fixed',
      left: leftPosition,
      top: topPosition,
      maxHeight: maxHeightValue,
      width: widthPosition,
      bottom: bottomPosition,
      padding: padding,
    });

    return;
  }, [isChatOpen, centerChat, maxWidth]);

  useLayoutEffect(() => {
    if (!isChatOpen) {
      return;
    }

    let rafId: number | null = null;

    const scheduleUpdate = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        updateChatPosition();
        rafId = null;
      });
    };

    scheduleUpdate();

    const onResizeOrScroll = scheduleUpdate;
    window.addEventListener('resize', onResizeOrScroll, { passive: true });
    window.addEventListener('scroll', onResizeOrScroll, { passive: true });

    let inputResizeObserver: ResizeObserver | null = null;
    let messagesResizeObserver: ResizeObserver | null = null;
    let floatingResizeObserver: ResizeObserver | null = null;

    if (!centerChat && inputRef.current && 'ResizeObserver' in window) {
      inputResizeObserver = new ResizeObserver(scheduleUpdate);
      inputResizeObserver.observe(inputRef.current);
    }

    if (messagesRef.current && 'ResizeObserver' in window) {
      messagesResizeObserver = new ResizeObserver(scheduleUpdate);
      messagesResizeObserver.observe(messagesRef.current);
    }

    if (chatRef.current && 'ResizeObserver' in window) {
      floatingResizeObserver = new ResizeObserver(scheduleUpdate);
      floatingResizeObserver.observe(chatRef.current);
    }

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll);
      inputResizeObserver?.disconnect();
      messagesResizeObserver?.disconnect();
      floatingResizeObserver?.disconnect();
    };
  }, [isChatOpen, centerChat, updateChatPosition]);

  return {
    inputContainerRef: inputRef,
    chatMessagesRef: messagesRef,
    floatingChatRef: chatRef,
    setFloatingChatRefCallback,
    chatStyle,
    chatDomElement,
  };
};
