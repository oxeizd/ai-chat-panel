import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSuggestionsOptions {
  suggestions: string[];
  placement: 'always' | 'onFocus';
  hideWhen?: boolean;
}

export const useSuggestions = ({ suggestions, placement, hideWhen = false }: UseSuggestionsOptions) => {
  const [showPopup, setShowPopup] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const onFocus = useCallback(() => {
    if (placement === 'onFocus' && !hideWhen && suggestions.length > 0 && !blockOpen) {
      setShowPopup(true);
    }
  }, [placement, hideWhen, suggestions.length, blockOpen]);

  const onBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      if (popupRef.current && !popupRef.current.contains(document.activeElement)) {
        setShowPopup(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const closeAndBlock = useCallback(() => {
    setShowPopup(false);
    setBlockOpen(true);
    setTimeout(() => setBlockOpen(false), 500);
  }, []);

  return {
    showPopup,
    popupRef,
    inputRef,
    onFocus,
    onBlur,
    setShowPopup,
    closeAndBlock,
  };
};
