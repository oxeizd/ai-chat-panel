import React, { forwardRef, memo, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Input, Button, Dropdown, useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from './styles';
import { AgentConfig } from 'types';
import { ChatMenu } from './shared/ChatMenu';
import { useSuggestions } from './hooks/useSuggestions';

interface InputAreaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  isLoading: boolean;
  onClearChat: () => void;
  onExportChat: () => void;
  onOpenSettings: () => void;
  selectedAgent: AgentConfig;
  setSelectedAgent: (agent: AgentConfig) => void;
  className?: string;
  placeholderText: string;
  agents: AgentConfig[];
  onFocus?: () => void;
  onBlur?: () => void;
  centerInput?: boolean;
  suggestions?: string[];
  suggestionsPlacement?: 'always' | 'onFocus';
  inputFocused?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  onSuggestionClick: (suggestion: string) => void;
  hideSuggestions?: boolean;
  showSuggestions?: boolean;
}

export const InputArea = memo(
  forwardRef<HTMLDivElement, InputAreaProps>((props, ref) => {
    const theme = useTheme2();
    const styles = useStyles(theme);

    const { showPopup, popupRef, inputRef, onFocus, onBlur } = useSuggestions({
      suggestions: props.suggestions || [],
      placement: props.suggestionsPlacement || 'always',
      hideWhen: props.hideSuggestions || !props.showSuggestions,
    });

    const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; width: number } | null>(null);

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
      if (!showPopup) {return;}
      updatePopupPosition();
      window.addEventListener('scroll', updatePopupPosition, true);
      window.addEventListener('resize', updatePopupPosition);
      return () => {
        window.removeEventListener('scroll', updatePopupPosition, true);
        window.removeEventListener('resize', updatePopupPosition);
      };
    }, [showPopup, updatePopupPosition]);

    const handleSuggestionClick = (suggestion: string) => {
      props.onSuggestionClick(suggestion);
      // Закрываем popup после выбора
      if (popupRef.current) {
        // просто даём возможность закрыться через onBlur
        if (inputRef.current) {inputRef.current.blur();}
      }
    };

    const menu = (
      <ChatMenu
        agents={props.agents}
        onClearChat={props.onClearChat}
        onExportChat={props.onExportChat}
        onOpenSettings={props.onOpenSettings}
        onSelectAgent={props.setSelectedAgent}
        className={styles.menu.customMenu}
      />
    );

    const showSuggestionsAlways = !props.hideSuggestions &&
    props.showSuggestions && 
    props.suggestionsPlacement === 'always' &&
    props.suggestions &&
    props.suggestions.length > 0;

    const containerStyle = cx(
      styles.input.container,
      props.className,
      props.centerInput && styles.base.centeredInputWrapper
    );

    const popupContent = showPopup && props.suggestions && popupPosition && (
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
          {props.suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className={styles.suggestions.popupItem}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
        <div className={styles.suggestions.popupFooter}>
          Ответит: <strong>{props.selectedAgent.name}</strong>
        </div>
      </div>
    );

    return (
      <>
        <div ref={ref} className={containerStyle}>
          {props.showWelcomeMessage && props.welcomeMessage && (
            <div className={styles.welcome.message}>{props.welcomeMessage}</div>
          )}
          <div style={{ position: 'relative', width: '100%' }}>
            <div className={styles.input.inlineWrapper}>
              <Input
                ref={inputRef}
                className={styles.input.box}
                value={props.value}
                onChange={props.onChange}
                onKeyDown={props.onKeyDown}
                onFocus={() => {
                  onFocus();
                  if (props.onFocus) {props.onFocus();}
                }}
                onBlur={() => {
                  onBlur();
                  if (props.onBlur) {props.onBlur();}
                }}
                placeholder={props.placeholderText}
                suffix={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="arrow-right"
                    onClick={props.onSend}
                    disabled={props.isLoading || !props.value.trim()}
                    aria-label="Отправить сообщение"
                  />
                }
              />
              <Dropdown overlay={menu} placement="bottom-end">
                <Button variant="secondary" size="sm" icon="bars" className={styles.header.iconButton} aria-label="Меню" />
              </Dropdown>
            </div>
          </div>

          {showSuggestionsAlways && (
            <div className={styles.suggestions.container}>
              {props.suggestions!.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={styles.suggestions.item}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
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
