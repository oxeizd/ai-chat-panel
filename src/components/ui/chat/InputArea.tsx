import React, { forwardRef, memo, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Input, Button, Dropdown, useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from '../core/styles';
import { ChatMenu } from 'components/ui/shared/ChatMenu';
import { useSuggestions } from 'components/ui/hooks/useSuggestions';
import { useChat } from '../core/chatConfig';

interface InputAreaProps {
  className?: string;
  onSend?: () => void;
  onContinue?: () => void;
  continueMode?: boolean;
  onSendText?: (text: string) => void;
}

const formatWelcomeMessage = (text: string) => {
  if (!text) {
    return null;
  }

  const parts = text.split(/(\{[^:]+:[^}]+\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{([^:]+):(.+)\}$/);
    return match ? (
      <span key={i} style={{ color: match[1] }}>
        {match[2]}
      </span>
    ) : (
      part
    );
  });
};

export const InputArea = memo(
  forwardRef<HTMLDivElement, InputAreaProps>((props, ref) => {
    const theme = useTheme2();
    const styles = useStyles(theme);
    const chat = useChat();
    const {
      inputValue,
      setInputValue,
      sendMessage,
      isLoading,
      clearChat,
      exportChat,
      openSettings,
      newChat,
      selectedAgent,
      setSelectedAgent,
      agents,
      placeholderText,
      centerInput,
      suggestions,
      suggestionsPlacement,
      showSuggestions,
      welcomeMessage,
      showWelcomeMessage,
      inputAreaBackground,
    } = chat;

    const { showPopup, popupRef, inputRef, onFocus, onBlur } = useSuggestions({
      suggestions: suggestions || [],
      placement: suggestionsPlacement || 'always',
      hideWhen: !showSuggestions,
    });

    const [popupPosition, setPopupPosition] = useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

    const updatePopupPosition = useCallback(() => {
      if (inputRef.current && showPopup) {
        const rect = inputRef.current.getBoundingClientRect();
        setPopupPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setPopupPosition(null);
      }
    }, [inputRef, showPopup]);

    useEffect(() => {
      if (!showPopup) {
        return;
      }
      updatePopupPosition();
      window.addEventListener('scroll', updatePopupPosition, true);
      window.addEventListener('resize', updatePopupPosition);
      return () => {
        window.removeEventListener('scroll', updatePopupPosition, true);
        window.removeEventListener('resize', updatePopupPosition);
      };
    }, [showPopup, updatePopupPosition]);

    const handleSuggestionClick = (suggestion: string) => {
      if (props.onSendText) {
        props.onSendText(suggestion);
      } else {
        setInputValue(suggestion);
        if (props.onSend) {
          props.onSend();
        } else {
          sendMessage();
        }
      }
      inputRef.current?.blur();
    };

    const menu = (
      <ChatMenu
        agents={agents}
        onClearChat={clearChat}
        onExportChat={exportChat}
        onOpenSettings={openSettings}
        onSelectAgent={setSelectedAgent}
        selectedAgent={selectedAgent}
        onNewChat={newChat}
        className={styles.menu.customMenu}
      />
    );

    const showSuggestionsAlways =
      showSuggestions && suggestionsPlacement === 'always' && suggestions && suggestions.length > 0;

    const containerStyle = cx(styles.input.container, props.className, centerInput && styles.input.centredContainer);
    const inlineWrapperStyle = cx(
      styles.input.inlineWrapper,
      props.className,
      inputAreaBackground && styles.input.inlineWrapperArea
    );

    const blurButton = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
    };

    const handleAction = () => {
      if (props.continueMode) {
        props.onContinue?.();
      } else {
        if (props.onSend) {
          props.onSend();
        } else {
          sendMessage();
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAction();
      }
    };

    const actionButton = props.continueMode ? (
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          blurButton(e);
          handleAction();
        }}
        aria-label="Продолжить диалог"
      >
        Продолжить...
      </Button>
    ) : (
      <Button
        variant="secondary"
        size="sm"
        icon="arrow-right"
        onClick={(e) => {
          blurButton(e);
          handleAction();
        }}
        disabled={isLoading || !inputValue.trim()}
        aria-label="Отправить сообщение"
      />
    );

    const popupContent = showPopup && suggestions && popupPosition && (
      <div
        ref={popupRef}
        className={styles.suggestions.popupPortal}
        style={{
          top: popupPosition.top,
          left: popupPosition.left,
          width: popupPosition.width,
        }}
      >
        <div className={styles.suggestions.popupHeader}>Можно спросить:</div>
        <div className={styles.suggestions.popupList}>
          {suggestions.map((suggestion, idx) => (
            <div key={idx} className={styles.suggestions.popupItem} onClick={() => handleSuggestionClick(suggestion)}>
              {suggestion}
            </div>
          ))}
        </div>
        <div className={styles.suggestions.popupFooter}>
          Ответит: <strong>{selectedAgent?.name || 'Агент не выбран'}</strong>
        </div>
      </div>
    );

    return (
      <>
        <div ref={ref} className={containerStyle}>
          {showWelcomeMessage && welcomeMessage && (
            <div className={styles.welcome.message}>{formatWelcomeMessage(welcomeMessage)}</div>
          )}
          <div style={{ position: 'relative', width: '100%' }}>
            <div className={inlineWrapperStyle}>
              <Input
                ref={inputRef}
                className={styles.input.box}
                value={inputValue}
                onChange={(e) => setInputValue(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={placeholderText}
                suffix={actionButton}
              />
              <Dropdown overlay={menu} placement="bottom-end">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="bars"
                  className={styles.header.iconButton}
                  onClick={blurButton}
                  aria-label="Меню"
                />
              </Dropdown>
            </div>
          </div>

          {showSuggestionsAlways && (
            <div className={styles.suggestions.container}>
              {suggestions!.map((suggestion, idx) => (
                <div key={idx} className={styles.suggestions.item} onClick={() => handleSuggestionClick(suggestion)}>
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        {ReactDOM.createPortal(popupContent, document.body)}
      </>
    );
  })
);

InputArea.displayName = 'InputArea';
