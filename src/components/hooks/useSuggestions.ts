import { useState, useEffect, useRef } from 'react';

interface UseSuggestionsOptions {
  suggestions: string[];
  placement: 'always' | 'onFocus';
  hideWhen?: boolean; // скрывать подсказки, если true
}

export const useSuggestions = ({ suggestions, placement, hideWhen = false }: UseSuggestionsOptions) => {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFocus = () => {
    if (placement === 'onFocus' && !hideWhen && suggestions.length > 0) {
      setShowPopup(true);
    }
  };

  const onBlur = () => {
    setTimeout(() => {
      if (popupRef.current && !popupRef.current.contains(document.activeElement)) {
        setShowPopup(false);
      }
    }, 200);
  };

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    showPopup,
    popupRef,
    inputRef,
    onFocus,
    onBlur,
    setShowPopup,
  };
};
