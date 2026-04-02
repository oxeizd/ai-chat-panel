import { useEffect, RefObject } from 'react';

export const useAutoScroll = (ref: RefObject<HTMLElement>, deps: React.DependencyList) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const scrollToBottom = () => {
      element.scrollTop = element.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);
};
