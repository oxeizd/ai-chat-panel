import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';

import { Message } from 'types';
import { AgentMenu } from './AgentMenu';
import { useChatActions, useChatState } from '../chat/ChatContext';
import { useStyles } from '../styles/styles';
import { blurButton } from '../utils/dom';
import { useChatHistory } from '../hooks/useChatHistory';

export const BottomButtons: React.FC = () => {
  const { isLoading, messages } = useChatState();
  const { debug, testMessageButton } = useChatActions();
  const { selectedAgent, agents, setSelectedAgent, newChat, setMessages } = useChatActions();

  const theme = useTheme2();
  const styles = useStyles(theme);

  const { openHistoryModal } = useChatHistory();

  const sendTestAiMessage = () => {
    const raw = window.prompt(
      'Текст сообщения от AI, либо JSON вида {"text":"...","interactive":{"options":[...],"fields":[...]}}'
    );

    if (!raw || !raw.trim()) {
      return;
    }

    const trimmed = raw.trim();
    let text = trimmed;
    let interactive: Message['interactive'] | undefined;
    let fileAttachment: Message['fileAttachment'] | undefined;

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        text = typeof parsed.text === 'string' ? parsed.text : '';
        interactive = parsed.interactive;
        fileAttachment = parsed.fileAttachment;
      } catch (err) {
        window.alert(`Некорректный JSON: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    const newMessage: Message = {
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      text,
      sender: 'ai',
      timestamp: Date.now(),
      interactive,
      fileAttachment,
    };
    setMessages([...messages, newMessage]);
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

      {selectedAgent?.history && (
        <Button
          variant="secondary"
          size="sm"
          icon="history"
          onClick={(event) => {
            blurButton(event);
            openHistoryModal();
          }}
          disabled={isLoading}
          className={styles.bottomButtons.newChatButton}
        >
          История
        </Button>
      )}

      {debug && testMessageButton && (
        <Button
          variant="secondary"
          size="sm"
          icon="edit"
          onClick={sendTestAiMessage}
          title="Тестовое сообщение от AI"
          disabled={isLoading}
          className={styles.bottomButtons.newChatButton}
        >
          AI message
        </Button>
      )}

      <Button
        variant="secondary"
        size="sm"
        icon="plus"
        onClick={(event) => {
          blurButton(event);
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
