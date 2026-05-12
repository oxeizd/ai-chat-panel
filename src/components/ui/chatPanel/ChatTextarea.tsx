import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from '../styles/styles';
import { SubmitButton, useSubmitBehavior } from '../hooks/useSubmitBehavior';
import { useWheelPrevention } from '../hooks/useWheelPrevention';
import { useChatActions, useChatState } from '../chat/ChatContext';

interface ChatTextareaProps {
  disabled?: boolean;
}

export const ChatTextarea: React.FC<ChatTextareaProps> = ({ disabled }) => {
  const { inputValue, isLoading } = useChatState();
  const { setInputValue, sendMessage, placeholderText } = useChatActions();

  const theme = useTheme2();
  const styles = useStyles(theme);
  const handleWheel = useWheelPrevention();
  const { handleKeyDown } = useSubmitBehavior(() => sendMessage());

  return (
    <div className={styles.input.container}>
      <div style={{ position: 'relative', width: '100%' }}>
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
        <SubmitButton
          onClick={() => sendMessage()}
          disabled={isLoading || !inputValue.trim()}
          className={cx(styles.input.sendButton)}
        />
      </div>
    </div>
  );
};
