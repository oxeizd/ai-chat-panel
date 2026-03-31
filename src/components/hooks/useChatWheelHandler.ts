// hooks/useChatWheelHandler.ts
import { useEffect } from 'react';
import { isElementInsideChat } from '../utils/domUtils';

export const useChatWheelHandler = (
  isChatOpen: boolean,
  chatRef: React.RefObject<HTMLElement>
) => {
  useEffect(() => {
    if (!isChatOpen) {return;}

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (!isElementInsideChat(target, chatRef)) {
        return;
      }

      // Находим скроллируемый элемент внутри чата
      let scrollable = target;
      while (scrollable && scrollable !== chatRef.current) {
        const overflowY = getComputedStyle(scrollable).overflowY;
        const canScroll = overflowY === 'auto' || overflowY === 'scroll';
        if (canScroll && scrollable.scrollHeight > scrollable.clientHeight) {
          const atTop = scrollable.scrollTop === 0;
          const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight;
          if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
            return;
          }
          break;
        }
        scrollable = scrollable.parentElement as HTMLElement;
      }

      if (chatRef.current) {
        const { scrollTop, clientHeight, scrollHeight } = chatRef.current;
        const atTop = scrollTop === 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight;
        
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
          return;
        }
      }

      e.preventDefault();
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [isChatOpen, chatRef]);
};
