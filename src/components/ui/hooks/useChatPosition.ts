import { useState, useRef, useLayoutEffect, useCallback } from 'react';

const settings = {
  margin: 8,
  top_offset: 100,
  minHeight: 500,
  minWrapperHeight: 150,
  contentLimit: 0.96,
  padding: 16,
};

export const useChatPosition = (isChatOpen: boolean, centerChat: boolean, maxWidth = 1300) => {
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const floatingChatRef = useRef<HTMLDivElement | null>(null);
  const [chatDomElement, setChatDomElement] = useState<HTMLElement | null>(null);
  const [chatStyle, setChatStyle] = useState<React.CSSProperties>({
    left: 0,
    top: undefined,
    bottom: undefined,
    maxHeight: settings.minHeight,
    width: 0,
  });

  const setFloatingChatRefCallback = useCallback((node: HTMLDivElement | null) => {
    floatingChatRef.current = node;
    setChatDomElement(node);
  }, []);

  const updateChatPosition = useCallback(() => {
    const desiredHeight =
      floatingChatRef.current?.offsetHeight ?? (chatMessagesRef.current?.scrollHeight || 0) + settings.minWrapperHeight;

    if (centerChat) {
      const maxHeight = Math.floor((window.innerHeight - settings.top_offset) * 0.96);
      const height = Math.min(maxHeight, Math.max(settings.minHeight, desiredHeight));
      const top =
        window.innerHeight / 2 - Math.floor(height / 2) < 100
          ? `${settings.top_offset}px`
          : `calc(50% - ${Math.floor(height / 2)}px)`;

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
        padding: settings.padding,
      });

      return;
    }

    if (!inputContainerRef.current || !isChatOpen) {
      return;
    }

    const rect = inputContainerRef.current.getBoundingClientRect();
    const { contentLimit: viewportLimit, margin } = settings;

    const top = Math.max(settings.top_offset, rect.top);
    const bottom = window.innerHeight - rect.bottom + settings.margin;
    const freerTop = Math.max(0, top - settings.top_offset);
    const freeBottom = Math.max(0, (window.innerHeight - top + margin) * viewportLimit);

    const showAbove = freerTop >= desiredHeight;
    const showBelow = freeBottom >= desiredHeight;
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
      maxHeightValue = window.innerHeight - bottom - settings.top_offset;
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
      padding: settings.padding,
    });

    return;
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
