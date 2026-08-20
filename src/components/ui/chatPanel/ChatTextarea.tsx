import React, { useCallback } from 'react';
import { useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from '../styles/styles';
import { SubmitButton, useSubmitBehavior } from '../hooks/useSubmitBehavior';
import { useWheelPrevention } from '../hooks/useWheelPrevention';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { InteractiveOptionsColumn, InteractiveFieldsForm } from 'components/ui/messages/InteractivePrompt';

interface ChatTextareaProps {
  disabled?: boolean;
}

export const ChatTextarea: React.FC<ChatTextareaProps> = ({ disabled }) => {
  const { inputValue, isLoading, pendingInteractive } = useChatState();
  const { setInputValue, sendMessage, sendInteractive, placeholderText } = useChatActions();

  const theme = useTheme2();
  const styles = useStyles(theme);
  const handleWheel = useWheelPrevention();
  const { handleKeyDown } = useSubmitBehavior(() => sendMessage());

  const handleInteractiveSubmit = useCallback(
    (text: string, extraContext?: Record<string, any>) => {
      if (pendingInteractive) {
        sendInteractive(pendingInteractive.messageId, text, extraContext);
      }
    },
    [pendingInteractive, sendInteractive]
  );

  const hasFieldsForm = !!pendingInteractive?.payload.fields?.length;
  const hasOptions = !!pendingInteractive?.payload.options?.length;

  return (
    <div className={styles.input.container}>
      {hasFieldsForm ? (
        <InteractiveFieldsForm
          fields={pendingInteractive!.payload.fields!}
          onSubmit={handleInteractiveSubmit}
          sendButtonClassName={styles.input.sendButton}
        />
      ) : hasOptions ? (
        <InteractiveOptionsColumn
          options={pendingInteractive!.payload.options!}
          onSubmit={handleInteractiveSubmit}
          sendButtonClassName={styles.input.sendButton}
        />
      ) : (
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
      )}
    </div>
  );
};
