import React, { useRef, useLayoutEffect } from 'react';
import { cx } from '@emotion/css';
import { Button, Spinner, Dropdown, Menu, useTheme2 } from '@grafana/ui';
import { getStyles } from './ChatPanel.styles';
import { Message, AgentConfig } from 'types';

interface InlineChatProps {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: () => void;
  clearChat: () => void;
  newChat: () => void;
  selectedAgent: AgentConfig;
  setSelectedAgent: (agent: AgentConfig) => void;
  exportChat: () => void;
  openSettings: () => void;
  placeholderText: string;
  agents: AgentConfig[];
}

export const InlineChat: React.FC<InlineChatProps> = (props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [props.messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.sendMessage();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const atTop = container.scrollTop === 0;
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight;
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      e.preventDefault();
    }
  };

  const menu = (
    <Menu className={styles.customMenu}>
      <Menu.Item label="Очистить чат" onClick={props.clearChat} />
      <Menu.Divider />
      <Menu.Item label="Экспорт чата" onClick={props.exportChat} />
      <Menu.Divider />
      <Menu.Item label="Выбрать агента" disabled />
      {props.agents.map((agent) => (
        <Menu.Item key={agent.name} label={agent.name} onClick={() => props.setSelectedAgent(agent)} />
      ))}
      <Menu.Divider />
      <Menu.Item label="Настройки" onClick={props.openSettings} />
    </Menu>
  );

  const agentMenu = (
    <Menu className={styles.customMenu}>
      {props.agents.map((agent) => (
        <Menu.Item key={agent.name} label={agent.name} onClick={() => props.setSelectedAgent(agent)} />
      ))}
    </Menu>
  );

  return (
    <div className={styles.normalWrapper} style={{ height: '100%' }}>
      <div className={styles.chatHeader}>
        <Dropdown overlay={menu} placement="bottom-end">
          <Button variant="secondary" size="sm" icon="bars" className={styles.iconButton} aria-label="Меню" />
        </Dropdown>
      </div>

      <div ref={messagesContainerRef} className={styles.chatMessagesContainer} onWheel={handleWheel}>
        {props.messages.length === 0 && props.placeholderText && (
          <div style={{ textAlign: 'center', opacity: 0.7, padding: '20px' }}>{props.placeholderText}</div>
        )}
        {props.messages.map((msg, idx) => (
          <div
            key={idx}
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
          onChange={(e) => props.setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholderText}
          rows={3}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-right"
          onClick={props.sendMessage}
          disabled={props.isLoading || !props.inputValue.trim()}
          className={styles.sendButton}
          aria-label="Отправить сообщение"
        />
      </div>

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
          onClick={props.newChat}
          className={styles.newChatButton}
          aria-label="Новый чат"
        >
          Новый чат
        </Button>
      </div>
    </div>
  );
};
