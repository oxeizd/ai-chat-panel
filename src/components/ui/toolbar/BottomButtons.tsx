import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';
import { AgentMenu } from './AgentMenu';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { useStyles } from '../styles/styles';
import { blurButton } from '../utils/dom';

export const BottomButtons: React.FC = () => {
  const { messages, isLoading } = useChatState();
  const { selectedAgent, agents, setSelectedAgent, newChat, debug, setMessages } = useChatActions();
  const theme = useTheme2();
  const styles = useStyles(theme);

  const sendTestAiMessage = () => {
    const text = window.prompt('Введите текст сообщения от AI');
    if (text && text.trim()) {
      const newMessage = {
        id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        text: text.trim(),
        sender: 'ai' as const,
        timestamp: Date.now(),
      };
      setMessages([...messages, newMessage]);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Dropdown
        overlay={
          <AgentMenu
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            className={styles.menu.customMenu}
          />
        }
        placement="top-start"
      >
        <Button
          variant="secondary"
          size="sm"
          className={styles.bottomButtons.agentButton}
          icon="user"
          onClick={blurButton}
          disabled={isLoading}
        >
          {selectedAgent ? selectedAgent.name : 'Агент не выбран'}
        </Button>
      </Dropdown>

      {debug && (
        <Button
          variant="secondary"
          size="sm"
          icon="edit"
          onClick={sendTestAiMessage}
          title="Отправить тестовое сообщение от AI (Markdown, графики, формулы)"
        >
          Тест AI
        </Button>
      )}

      <Button
        variant="secondary"
        size="sm"
        icon="plus"
        onClick={(e) => {
          blurButton(e);
          newChat();
        }}
        disabled={isLoading}
        className={styles.bottomButtons.newChatButton}
      >
        Новый чат
      </Button>
    </div>
  );
};
