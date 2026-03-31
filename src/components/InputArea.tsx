import React, { forwardRef } from 'react';
import { Input, Button, Dropdown, Menu } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { getStyles } from './ChatPanel.styles';
import { AgentConfig } from 'types';

interface InputAreaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
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
}

export const InputArea = forwardRef<HTMLDivElement, InputAreaProps>((props, ref) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const menu = (
    <Menu className={styles.customMenu}>
      <Menu.Item label="Очистить чат" onClick={props.onClearChat} />
      <Menu.Divider />
      <Menu.Item label="Экспорт чата" onClick={props.onExportChat} />
      <Menu.Divider />
      <Menu.Item label="Выбрать агента" disabled />
      {props.agents.map((agent) => (
        <Menu.Item
          key={agent.name}
          label={agent.name}
          onClick={() => props.setSelectedAgent(agent)}
        />
      ))}
      <Menu.Divider />
      <Menu.Item label="Настройки" onClick={props.onOpenSettings} />
    </Menu>
  );

  return (
    <div ref={ref} className={cx(styles.inputContainer, props.className)}>
      <Input
        className={styles.inputBox}
        value={props.value}
        onChange={props.onChange}
        onKeyPress={props.onKeyPress}
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
        <Button
          variant="secondary"
          size="sm"
          icon="bars"
          className={styles.iconButton}
          aria-label="Меню"
        />
      </Dropdown>
    </div>
  );
});