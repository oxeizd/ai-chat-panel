import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';
import { AgentMenu } from './AgentMenu';
import { useChat } from './ChatContext';
import { useStyles } from '../styles';

const blurButton = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.blur();
};

export const BottomButtons: React.FC = () => {
  const { selectedAgent, agents, setSelectedAgent, newChat } = useChat();
  const theme = useTheme2();
  const styles = useStyles(theme);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Dropdown
        overlay={<AgentMenu agents={agents} onSelectAgent={setSelectedAgent} className={styles.menu.customMenu} />}
        placement="top-start"
      >
        <Button
          variant="secondary"
          size="sm"
          className={styles.bottomButtons.agentButton}
          icon="user"
          onClick={blurButton}
        >
          {selectedAgent.name}
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
        className={styles.bottomButtons.newChatButton}
      >
        Новый чат
      </Button>
    </div>
  );
};
