import React from 'react';
import { Modal, Button, useTheme2, IconButton } from '@grafana/ui';
import { ChatHistoryItem } from 'types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  historyChats: ChatHistoryItem[];
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => Promise<void>;
  hasDeleteOperation: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  historyChats,
  onSelectChat,
  onDeleteChat,
  hasDeleteOperation,
}) => {
  const theme = useTheme2();

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!hasDeleteOperation) {
      return;
    }
    await onDeleteChat(chatId);
  };

  return (
    <Modal title="История диалогов" isOpen={isOpen} onDismiss={onClose}>
      <div style={{ padding: '16px 0' }}>
        {historyChats.length === 0 ? (
          <p>Нет сохранённых диалогов</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {historyChats.map((chat) => (
              <li
                key={chat.id}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderBottom: `1px solid ${theme.colors.border.medium}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => onSelectChat(chat.id)}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{chat.title}</div>
                  <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>{chat.date}</div>
                  {chat.preview && <div style={{ fontSize: '12px' }}>{chat.preview}</div>}
                </div>
                <IconButton
                  name="trash-alt"
                  onClick={(e) => handleDelete(e, chat.id)}
                  tooltip={hasDeleteOperation ? 'Удалить диалог' : 'Удаление не настроено'}
                  disabled={!hasDeleteOperation}
                />
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};
