import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';
import { ChatMenu } from './ChatMenu';
import { useChat } from 'components/ui/core/ChatConfig';
import { useStyles } from 'components/ui/core/styles';

interface ChatHeaderProps {
  onBack?: () => void;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  welcomeMessage?: string;
}

const blurButton = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.blur();
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onBack,
  isFullscreen,
  onFullscreen,
  welcomeMessage: propWelcomeMessage,
}) => {
  const {
    agents,
    clearChat,
    exportChat,
    openSettings,
    setSelectedAgent,
    selectedAgent,
    newChat,
    welcomeMessage: contextWelcomeMessage,
  } = useChat();

  const theme = useTheme2();
  const styles = useStyles(theme);
  const displayWelcome = propWelcomeMessage ?? contextWelcomeMessage;

  const menuButton = (
    <Dropdown
      overlay={
        <ChatMenu
          agents={agents}
          onClearChat={clearChat}
          onExportChat={exportChat}
          onOpenSettings={openSettings}
          onSelectAgent={setSelectedAgent}
          selectedAgent={selectedAgent}
          onNewChat={newChat}
          className={styles.menu.customMenu}
        />
      }
      placement="bottom-end"
    >
      <Button
        variant="secondary"
        size="sm"
        icon="bars"
        className={styles.header.iconButton}
        onClick={blurButton}
        aria-label="Меню"
      />
    </Dropdown>
  );

  const fullscreenButton = onFullscreen && (
    <Button
      variant="secondary"
      size="sm"
      icon={isFullscreen ? 'times' : 'external-link-alt'}
      onClick={(e) => {
        blurButton(e);
        onFullscreen();
      }}
      className={styles.header.iconButton}
      aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
    />
  );

  const leftSection = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {onBack && (
        <Button
          icon="arrow-left"
          variant="secondary"
          size="sm"
          onClick={(e) => {
            blurButton(e);
            onBack();
          }}
          className={styles.header.iconButton}
          aria-label="Назад"
        />
      )}
      {!onBack && displayWelcome && <span style={{ fontSize: '0.9rem' }}>{displayWelcome}</span>}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px 0 16px',
      }}
    >
      <div style={{ flex: 1 }}>{leftSection}</div>
      {fullscreenButton}
      {menuButton}
    </div>
  );
};
