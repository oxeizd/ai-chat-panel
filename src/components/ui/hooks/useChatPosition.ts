import { useState, useRef, useLayoutEffect, useCallback } from 'react';

type ChatStyle = React.CSSProperties & { maxHeight?: number | undefined };

const SETTINGS = {
  margin: 8,
  topOffset: 100,
  minHeight: 500,
  minWrapperHeight: 150,
  contentLimit: 0.98,
  padding: 16,
  sidePadding: 12,
};

export const useChatPosition = (isChatOpen: boolean, centerChat: boolean, fullScale: boolean, maxWidth = 1300) => {
  const mountedRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);

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
    if (!isChatOpen) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    const { margin, topOffset, minHeight, minWrapperHeight, contentLimit, padding, sidePadding } = SETTINGS;

    const chatHeight = chatRef.current?.offsetHeight;
    const messagesHeight = (messagesRef.current?.scrollHeight || 0) + minWrapperHeight;
    const targetHeight = chatHeight ?? messagesHeight;

    if (centerChat) {
      const maxHeight = Math.floor((window.innerHeight - topOffset) * contentLimit);

      let height;

      if (fullScale) {
        height = maxHeight;
      } else {
        height = Math.min(maxHeight, Math.max(minHeight, targetHeight));
      }

      let top;

      if (window.innerHeight / 2 - Math.floor(height / 2) < topOffset) {
        top = `${topOffset}px`;
      } else {
        top = `calc(50% - ${Math.floor(height / 2)}px)`;
      }

      let width: number;

      if (typeof maxWidth !== 'number' || maxWidth <= 0) {
        if (inputRef.current) {
          width = inputRef.current.getBoundingClientRect().width;
        } else {
          width = 1300;
        }
      } else {
        width = 1300;
      }

      if (window.innerWidth < width) {
        width = Math.round(window.innerWidth * 0.8);
      }

      if (mountedRef.current) {
        setChatStyle({
          position: 'fixed',
          left: `calc(50% - ${Math.floor(width / 2)}px)`,
          top,
          width,
          height: fullScale ? height : undefined,
          maxHeight: fullScale ? undefined : maxHeight,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding,
        });
      }

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
    } else {
      maxHeightValue = window.innerHeight - bottom - topOffset;
      bottomPosition = bottom;
    }

    let leftPosition: number | undefined;
    let widthPosition: number | undefined;

    if (maxWidth > rect.width) {
      widthPosition = maxWidth;
      let desiredLeft = rect.right - widthPosition;
      leftPosition = Math.max(sidePadding, Math.min(desiredLeft, window.innerWidth - widthPosition - sidePadding));
    } else {
      leftPosition = rect.left;
      widthPosition = rect.width;
    }

    if (mountedRef.current) {
      setChatStyle({
        position: 'fixed',
        left: leftPosition,
        top: fullScale ? topOffset : topPosition,
        height: fullScale ? maxHeightValue : undefined,
        maxHeight: fullScale ? undefined : maxHeightValue,
        width: widthPosition,
        bottom: bottomPosition,
        padding: padding,
      });
    }
  }, [isChatOpen, centerChat, maxWidth, fullScale]);

  const scheduleUpdate = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      if (mountedRef.current) {
        updateChatPosition();
      }
      rafIdRef.current = null;
    });
  }, [updateChatPosition]);

  useLayoutEffect(() => {
    mountedRef.current = true;

    if (!isChatOpen) {
      return;
    }

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
      mountedRef.current = false;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll);

      inputResizeObserver?.disconnect();
      messagesResizeObserver?.disconnect();
      floatingResizeObserver?.disconnect();
    };
  }, [isChatOpen, centerChat, scheduleUpdate]);

  return {
    inputContainerRef: inputRef,
    chatMessagesRef: messagesRef,
    floatingChatRef: chatRef,
    setFloatingChatRefCallback,
    chatStyle,
    chatDomElement,
  };
};
