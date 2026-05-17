import { useState, useCallback } from 'react';

export const useCopyToClipboard = (timeoutMs = 2000) => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeoutMs);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    [timeoutMs]
  );

  return { copied, copy };
};
