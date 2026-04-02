// shared/ChatHeader.tsx
import React from 'react';
import { Button, Dropdown } from '@grafana/ui';
import { ChatMenu } from './ChatMenu';
import { AgentConfig } from 'types';

interface ChatHeaderProps {
  onBack?: () => void;
  agents: AgentConfig[];
  onClearChat: () => void;
  onExportChat: () => void;
  onOpenSettings: () => void;
  onSelectAgent: (agent: AgentConfig) => void;
  menuClassName: string;
  iconButtonClassName: string;
  welcomeMessage?: string;
  menuPosition?: 'left' | 'right';
  isFullscreen?: boolean;
  onFullscreen?: () => void;
}

const blurButton = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.blur();
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onBack,
  agents,
  onClearChat,
  onExportChat,
  onOpenSettings,
  onSelectAgent,
  menuClassName,
  iconButtonClassName,
  welcomeMessage,
  menuPosition = 'right',
  isFullscreen = false,
  onFullscreen,
}) => {
  const menuButton = (
    <Dropdown
      overlay={
        <ChatMenu
          agents={agents}
          onClearChat={onClearChat}
          onExportChat={onExportChat}
          onOpenSettings={onOpenSettings}
          onSelectAgent={onSelectAgent}
          className={menuClassName}
        />
      }
      placement="bottom-end"
    >
      <Button
        variant="secondary"
        size="sm"
        icon="bars"
        className={iconButtonClassName}
        aria-label="Меню"
        onClick={blurButton}
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
      className={iconButtonClassName}
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
          className={iconButtonClassName}
          aria-label="Назад"
        />
      )}
      {!onBack && welcomeMessage && <span style={{ fontSize: '0.9rem' }}>{welcomeMessage}</span>}
    </div>
  );

  if (menuPosition === 'left') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px 0 16px' }}>
        {menuButton}
        <div style={{ flex: 1 }}>{leftSection}</div>
        {fullscreenButton}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px 0 16px' }}>
      <div style={{ flex: 1 }}>{leftSection}</div>
      {fullscreenButton}
      {menuButton}
    </div>
  );
};
