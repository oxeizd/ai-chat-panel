import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { cx } from '@emotion/css';
import { Button, Dropdown, Menu, Spinner, useTheme2 } from '@grafana/ui';
import { getStyles } from './styles';
import { Message, AgentConfig } from 'types';

interface FloatingChatProps {
  chatStyle: {
    left: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
    width: number;
  };
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onClose: () => void;
  onClearChat: () => void;
  onExportChat: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  selectedAgent: AgentConfig;
  setSelectedAgent: (agent: AgentConfig) => void;
  chatMessagesRef: React.RefObject<HTMLDivElement>;
  floatingChatRef: React.RefObject<HTMLDivElement>;
  placeholderText: string;
  agents: AgentConfig[];
  maxWidth?: number;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  suggestions?: string[];
  suggestionsPlacement?: 'always' | 'onFocus';
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export const FloatingChat: React.FC<FloatingChatProps> = (props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (props.suggestionsPlacement === 'onFocus') {
      setShowPopup(props.inputFocused);
    }
  }, [props.inputFocused, props.suggestionsPlacement]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowPopup(false);
        props.setInputFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [props]);

  const handleSuggestionClick = (suggestion: string) => {
    props.onSuggestionClick(suggestion);
    setShowPopup(false);
    props.setInputFocused(false);
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

  const agentMenu = (
    <Menu className={styles.customMenu}>
      {props.agents.map((agent) => (
        <Menu.Item key={agent.name} label={agent.name} onClick={() => props.setSelectedAgent(agent)} />
      ))}
    </Menu>
  );

  const floatingStyle: React.CSSProperties = {
    left: props.chatStyle.left,
    top: props.chatStyle.top,
    bottom: props.chatStyle.bottom,
    maxHeight: props.chatStyle.maxHeight,
    width: props.chatStyle.width,
  };
  if (props.maxWidth && props.maxWidth > 0) {
    floatingStyle.maxWidth = props.maxWidth;
  }

  const showSuggestionsAlways = props.suggestionsPlacement === 'always' && props.suggestions && props.suggestions.length > 0;
  const showSuggestionsPopup = props.suggestionsPlacement === 'onFocus' && showPopup && props.suggestions && props.suggestions.length > 0;

  return ReactDOM.createPortal(
    <div
      ref={props.floatingChatRef}
      className={styles.floatingChat}
      style={floatingStyle}
    >
      <div className={styles.chatHeader}>
        <Button
          icon="arrow-left"
          variant="secondary"
          size="sm"
          onClick={props.onClose}
          className={styles.iconButton}
          aria-label="Назад"
        />
        <Dropdown overlay={menu} placement="bottom-end">
          <Button variant="secondary" size="sm" icon="bars" className={styles.iconButton} aria-label="Меню" />
        </Dropdown>
      </div>

      {props.showWelcomeMessage && props.welcomeMessage && (
        <div className={styles.welcomeMessage}>{props.welcomeMessage}</div>
      )}

      <div className={styles.chatMessagesContainer} ref={props.chatMessagesRef}>
        {props.messages.length === 0 && props.placeholderText && (
          <div style={{ textAlign: 'center', opacity: 0.7, padding: '20px' }}>{props.placeholderText}</div>
        )}
        {props.messages.map((msg) => (
          <div
            key={msg.id}
            className={cx(
              styles.messageWrapper,
              msg.sender === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
            )}
          >
            <div
              className={cx(
                styles.messageBubble,
                msg.sender === 'user' ? styles.userMessageBubble : styles.aiMessageBubble
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {props.isLoading && (
          <div className={cx(styles.messageWrapper, styles.aiMessageWrapper)}>
            <div className={cx(styles.messageBubble, styles.aiMessageBubble)}>
              <Spinner />
            </div>
          </div>
        )}
      </div>

      <div className={styles.chatInputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.chatTextarea}
          value={props.inputValue}
          onChange={props.onInputChange}
          onKeyDown={props.onKeyDown}
          onWheel={props.onWheel}
          onFocus={() => props.setInputFocused(true)}
          onBlur={() => {
            setTimeout(() => {
              if (!popupRef.current?.contains(document.activeElement)) {
                props.setInputFocused(false);
              }
            }, 200);
          }}
          placeholder={props.placeholderText}
          rows={3}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-right"
          onClick={props.onSend}
          disabled={props.isLoading || !props.inputValue.trim()}
          className={styles.sendButton}
          aria-label="Отправить сообщение"
        />
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

      <div className={styles.bottomButtons}>
        <Dropdown overlay={agentMenu} placement="top-start">
          <Button variant="secondary" size="sm" className={styles.agentButton} icon="user" aria-label="Выбор агента">
            {props.selectedAgent.name}
          </Button>
        </Dropdown>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={props.onNewChat}
          className={styles.newChatButton}
          aria-label="Новый чат"
        >
          Новый чат
        </Button>
      </div>
    </div>,
    document.body
  );
};