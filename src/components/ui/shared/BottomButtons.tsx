import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';
import { AgentMenu } from './AgentMenu';
import { useChat } from '../core/chatConfig';
import { useStyles } from '../core/styles';
import { blurButton } from '../utils/dom';

export const BottomButtons: React.FC = () => {
  const { selectedAgent, agents, setSelectedAgent, newChat, isLoading } = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);

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
