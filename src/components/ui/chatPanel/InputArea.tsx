import ReactDOM from 'react-dom';
import React, { forwardRef, memo, useEffect, useCallback, useMemo } from 'react';
import { cx } from '@emotion/css';
import { Input, Button, Dropdown, useTheme2 } from '@grafana/ui';
import { useFloating, autoUpdate, flip, offset, size } from '@floating-ui/react';
import { useStyles } from '../styles/styles';
import { ChatMenu } from 'components/ui/toolbar/ChatMenu';
import { useSuggestions } from 'components/ui/hooks/useSuggestions';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { blurButton } from '../utils/dom';
import { SubmitButton, useSubmitBehavior } from '../hooks/useSubmitBehavior';

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

    const { className, onSend, onContinue, continueMode, onSendText } = props;
    const { inputValue, isLoading } = useChatState();
    const {
      setInputValue,
      sendMessage,
      selectedAgent,
      placeholderText,
      centerInput,
      suggestions,
      suggestionsPlacement,
      showSuggestions,
      welcomeMessage,
      showWelcomeMessage,
      inputAreaBackground,
    } = useChatActions();

    const { showPopup, popupRef, inputRef, onFocus, onBlur, setShowPopup } = useSuggestions({
      suggestions: suggestions || [],
      placement: suggestionsPlacement || 'always',
      hideWhen: !showSuggestions,
    });

    const { refs, floatingStyles } = useFloating({
      open: showPopup,
      placement: 'bottom-start',
      middleware: [
        offset(4),
        flip({ padding: 8 }),
        size({
          apply({ rects, elements }) {
            elements.floating.style.width = `${rects.reference.width}px`;
          },
        }),
      ],
      whileElementsMounted: autoUpdate,
    });

    useEffect(() => {
      if (inputRef.current) {
        refs.setReference(inputRef.current);
      }
    }, [inputRef, refs]);

    const handleSuggestionClick = useCallback(
      (suggestion: string) => {
        if (onSendText) {
          onSendText(suggestion);
        } else {
          setInputValue(suggestion);
          if (onSend) {
            onSend();
          } else {
            sendMessage(suggestion);
          }
        }
        inputRef.current?.blur();
        setShowPopup(false);
      },
      [onSendText, onSend, setInputValue, sendMessage, inputRef, setShowPopup]
    );

    const handleAction = useCallback(() => {
      if (continueMode) {
        onContinue?.();
      } else {
        if (onSend) {
          onSend();
        } else {
          sendMessage();
        }
      }
    }, [continueMode, onContinue, onSend, sendMessage]);

    const { handleKeyDown } = useSubmitBehavior(handleAction);

    const formattedWelcomeMessage = useMemo(() => formatWelcomeMessage(welcomeMessage || ''), [welcomeMessage]);

    const containerStyle = useMemo(
      () => cx(styles.input.container, className, centerInput && styles.input.centredContainer),
      [styles.input.container, styles.input.centredContainer, className, centerInput]
    );

    const inlineWrapperStyle = useMemo(
      () => cx(styles.input.inlineWrapper, className, inputAreaBackground && styles.input.inlineWrapperArea),
      [styles.input.inlineWrapper, styles.input.inlineWrapperArea, className, inputAreaBackground]
    );

    const actionButton = useMemo(() => {
      if (continueMode) {
        return (
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
        );
      }

      return <SubmitButton onClick={handleAction} disabled={isLoading || !inputValue.trim()} />;
    }, [continueMode, handleAction, isLoading, inputValue]);

    const menu = useMemo(() => <ChatMenu className={styles.menu.customMenu} />, [styles.menu.customMenu]);

    const showSuggestionsAlways = useMemo(
      () => showSuggestions && suggestionsPlacement === 'always' && suggestions && suggestions.length > 0,
      [showSuggestions, suggestionsPlacement, suggestions]
    );

    const popupContent = useMemo(() => {
      if (!showPopup || !suggestions) {
        return null;
      }

      return (
        <div
          ref={(node) => {
            refs.setFloating(node);
            if (popupRef) {
              (popupRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          className={styles.suggestions.popupPortal}
          style={floatingStyles}
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
    }, [showPopup, suggestions, styles, floatingStyles, refs, popupRef, handleSuggestionClick, selectedAgent]);

    return (
      <>
        <div ref={ref} className={containerStyle}>
          {showWelcomeMessage && welcomeMessage && (
            <div className={styles.welcome.message}>{formattedWelcomeMessage}</div>
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
