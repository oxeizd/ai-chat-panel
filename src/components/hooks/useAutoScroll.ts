import { useEffect, RefObject } from 'react';

export const useAutoScroll = (ref: RefObject<HTMLElement>, deps: any[] = []) => {
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [ref.current, ...deps]);
};
