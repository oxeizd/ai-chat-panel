import React from 'react';
import { Button, useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from '../styles';
import { useKeyboardSubmit } from '../hooks/useKeyboardSubmit';
import { useWheelPrevention } from '../hooks/useWheelPrevention';
import { useChat } from './ChatContext';

interface ChatTextareaProps {
  /** Set to true when the textarea is rendered inside the floating portal */
  disabled?: boolean;
}

/**
 * Textarea + send button for composing messages.
 * All chat data (value, onChange, onSend, isLoading, placeholder) is read
 * from ChatContext so callers only need to pass layout-specific props.
 */
export const ChatTextarea: React.FC<ChatTextareaProps> = ({ disabled }) => {
  const { inputValue, setInputValue, sendMessage, isLoading, placeholderText } = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);
  const handleKeyDown = useKeyboardSubmit(sendMessage);
  const handleWheel = useWheelPrevention();

  return (
    <div className={styles.input.container}>
      <textarea
        className={styles.input.textarea}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        placeholder={placeholderText}
        rows={3}
        disabled={disabled}
      />
      <Button
        variant="secondary"
        size="sm"
        icon="arrow-right"
        onClick={sendMessage}
        disabled={isLoading || !inputValue.trim()}
        className={cx(styles.input.sendButton)}
        aria-label="Отправить сообщение"
      />
    </div>
  );
};
