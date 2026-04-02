import { useCallback, WheelEvent } from 'react';

export const useWheelPrevention = () => {
  return useCallback((e: WheelEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const atTop = target.scrollTop === 0;
    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      e.preventDefault();
    }
  }, []);
};
