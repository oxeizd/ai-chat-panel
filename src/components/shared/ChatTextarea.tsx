import React from 'react';
import { Button, useTheme2 } from '@grafana/ui';
import { useStyles } from '../styles';
import { useKeyboardSubmit } from '../hooks/useKeyboardSubmit';
import { useWheelPrevention } from '../hooks/useWheelPrevention';
import { cx } from '@emotion/css';

interface ChatTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  isFloating?: boolean;
}

export const ChatTextarea: React.FC<ChatTextareaProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder,
  disabled,
  isFloating
}) => {
  const theme = useTheme2();
  const styles = useStyles(theme);
  const handleKeyDown = useKeyboardSubmit(onSend);
  const handleWheel = useWheelPrevention();

  return (
    <div className={styles.input.container}>
      <textarea
        className={styles.input.textarea}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
      />
      <Button
        variant="secondary"
        size="sm"
        icon="arrow-right"
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        className={cx(styles.input.sendButton, isFloating && styles.input.sendButtonFloating)}
        aria-label="Отправить сообщение"
      />
    </div>
  );
};
