import React, { useCallback, KeyboardEvent } from 'react';
import { Button } from '@grafana/ui';
import { blurButton } from '../utils/dom';

/**
 * Хук для поведения отправки: Enter без Shift вызывает onSubmit.
 * @param onSubmit - функция отправки
 * @returns handleKeyDown для onKeyDown поля ввода
 */
export const useSubmitBehavior = (onSubmit: () => void) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  return { handleKeyDown };
};

/**
 * Готовая кнопка отправки сообщения (иконка стрелки).
 */
export const SubmitButton: React.FC<{
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}> = ({ onClick, disabled = false, ariaLabel = 'Отправить сообщение', className }) => (
  <Button
    variant="secondary"
    size="sm"
    icon="arrow-right"
    onClick={(e) => {
      blurButton(e);
      onClick(e);
    }}
    disabled={disabled}
    aria-label={ariaLabel}
    className={className}
  />
);
