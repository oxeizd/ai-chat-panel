import React, { forwardRef, memo, useState, useRef, useEffect } from 'react';
import { Input, Button, Dropdown, Menu, useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useStyles } from './styles';
import { AgentConfig } from 'types';

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
}

export const InputArea = memo(
  forwardRef<HTMLDivElement, InputAreaProps>((props, ref) => {
    const theme = useTheme2();
    const styles = useStyles(theme);
    const [showPopup, setShowPopup] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (props.suggestionsPlacement === 'onFocus') {
        setShowPopup(props.inputFocused || false);
      }
    }, [props.inputFocused, props.suggestionsPlacement]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(event.target as Node) &&
            inputRef.current && !inputRef.current.contains(event.target as Node)) {
          setShowPopup(false);
          if (props.onBlur) props.onBlur();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [props]);

    const handleSuggestionClick = (suggestion: string) => {
      props.onSuggestionClick(suggestion);
      setShowPopup(false);
      if (props.onBlur) props.onBlur();
    };

    const menu = (
      <Menu className={styles.customMenu}>
        <Menu.Item label="Очистить чат" onClick={props.onClearChat} />
        <Menu.Divider />
        <Menu.Item label="Экспорт чата" onClick={props.onExportChat} />
        <Menu.Divider />
        <Menu.Item label="Выбрать агента" disabled />
        {props.agents.map((agent) => (
          <Menu.Item key={agent.name} label={agent.name} onClick={() => props.setSelectedAgent(agent)} />
        ))}
        <Menu.Divider />
        <Menu.Item label="Настройки" onClick={props.onOpenSettings} />
      </Menu>
    );

    const showSuggestionsAlways = props.suggestionsPlacement === 'always' && props.suggestions && props.suggestions.length > 0;
    const showSuggestionsPopup = props.suggestionsPlacement === 'onFocus' && showPopup && props.suggestions && props.suggestions.length > 0;

    const containerStyle = cx(
      styles.inputContainer,
      props.className,
      props.centerInput && styles.centeredInputWrapper
    );

    return (
      <div ref={ref} className={containerStyle}>
        {props.showWelcomeMessage && props.welcomeMessage && (
          <div className={styles.welcomeMessage}>{props.welcomeMessage}</div>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <Input
              ref={inputRef}
              className={styles.inputBox}
              value={props.value}
              onChange={props.onChange}
              onKeyDown={props.onKeyDown}
              onFocus={() => {
                if (props.onFocus) props.onFocus();
                if (props.suggestionsPlacement === 'onFocus') setShowPopup(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (!popupRef.current?.contains(document.activeElement)) {
                    if (props.onBlur) props.onBlur();
                    setShowPopup(false);
                  }
                }, 200);
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
              <Button variant="secondary" size="sm" icon="bars" className={styles.iconButton} aria-label="Меню" />
            </Dropdown>
          </div>
          {showSuggestionsPopup && (
            <div ref={popupRef} className={styles.suggestionsPopup}>
              {props.suggestions!.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        {showSuggestionsAlways && (
          <div className={styles.suggestionsContainer}>
            {props.suggestions!.map((suggestion, idx) => (
              <div
                key={idx}
                className={styles.suggestionItem}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  })
);

InputArea.displayName = 'InputArea';