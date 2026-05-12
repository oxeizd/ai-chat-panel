import React from 'react';
import { Button, Dropdown, useTheme2 } from '@grafana/ui';
import { ChatMenu } from './ChatMenu';
import { useChatActions } from '../chat/ChatContext';
import { useStyles } from 'components/ui/styles/styles';
import { blurButton } from '../utils/dom';

interface ChatHeaderProps {
  onBack?: () => void;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  threadId?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onBack, isFullscreen, onFullscreen, threadId }) => {
  const { debug } = useChatActions();

  const theme = useTheme2();
  const styles = useStyles(theme);

  const menuButton = (
    <Dropdown overlay={<ChatMenu className={styles.menu.customMenu} />} placement="bottom-end">
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
      {debug && threadId && (
        <span style={{ fontSize: '10px', color: theme.colors.text.secondary, marginLeft: '8px' }}>
          Thread: {threadId}
        </span>
      )}
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
