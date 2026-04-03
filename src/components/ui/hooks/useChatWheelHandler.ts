import { useEffect } from 'react';

const isElementInsideChat = (element: HTMLElement | null, chatElement: HTMLElement | null): boolean => {
  if (!chatElement) {
    return false;
  }
  let current = element;
  while (current) {
    if (current === chatElement) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

/**
 * Предотвращает прокрутку страницы, когда мышь находится внутри плавающего чата.
 * Позволяет прокручивать только прокручиваемые элементы внутри чата (например, список сообщений).
 */
export const useChatWheelHandler = (isChatOpen: boolean, chatElement: HTMLElement | null) => {
  useEffect(() => {
    if (!isChatOpen || !chatElement) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;

      if (!isElementInsideChat(target, chatElement)) {
        return;
      }

      // Ищем ближайший прокручиваемый элемент внутри чата
      let scrollable: HTMLElement | null = target;
      while (scrollable && scrollable !== chatElement) {
        const overflowY = getComputedStyle(scrollable).overflowY;
        const canScroll = overflowY === 'auto' || overflowY === 'scroll';
        if (canScroll && scrollable.scrollHeight > scrollable.clientHeight) {
          const atTop = scrollable.scrollTop === 0;
          const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight;

          if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
            // Элемент может прокручиваться в этом направлении – не мешаем, но и страницу не трогаем
            e.stopPropagation();
            return;
          }

          // Достигли границы – запрещаем прокрутку страницы
          e.preventDefault();
          return;
        }
        scrollable = scrollable.parentElement;
      }

      // Нет прокручиваемого элемента – запрещаем прокрутку страницы
      e.preventDefault();
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [isChatOpen, chatElement]);
};
