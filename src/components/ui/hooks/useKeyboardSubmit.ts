import { useCallback, KeyboardEvent } from 'react';

export const useKeyboardSubmit = (onSubmit: () => void) => {
  return useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );
};
