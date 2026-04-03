import React, { useState } from 'react';
import {
  Button,
  Input,
  TextArea,
  Checkbox,
  Modal,
  Switch,
  Field,
  Combobox,
  ComboboxOption,
  Collapse,
  useTheme2,
} from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { AgentConfig, EndpointConfig, PollingConfig } from 'types'; // путь подставьте свой

interface AgentsEditorProps {
  value?: AgentConfig[];
  onChange: (value: AgentConfig[]) => void;
}

const methodOptions: Array<ComboboxOption<string>> = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
];

const getEndpointEditorStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
  `,
});

// ----------------------------------------------
// EndpointEditor (редактор одного эндпоинта)
// ----------------------------------------------
const EndpointEditor: React.FC<{
  endpoint: EndpointConfig;
  index: number;
  onChange: (index: number, updated: EndpointConfig) => void;
  onRemove: (index: number) => void;
}> = ({ endpoint, index, onChange, onRemove }) => {
  const theme = useTheme2();
  const styles = getEndpointEditorStyles(theme);

  const handleChange = (field: keyof EndpointConfig, val: any) => {
    onChange(index, { ...endpoint, [field]: val });
  };

  const handleSaveToContextChange = (val: string) => {
    const fields = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    handleChange('saveToContext', fields);
  };

  const handlePollingChange = (enabled: boolean) => {
    const currentPolling = endpoint.polling || {};
    handleChange('polling', { ...currentPolling, enabled });
  };

  const handlePollingFieldChange = (field: keyof PollingConfig, val: any) => {
    const current = endpoint.polling || { enabled: false };
    handleChange('polling', { ...current, [field]: val });
  };

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <strong>Endpoint #{index + 1}</strong>
        <Button
          variant="destructive"
          size="sm"
          icon="trash-alt"
          onClick={() => onRemove(index)}
          aria-label="Delete endpoint"
        />
      </div>

      {/* Основное */}
      <div
        style={{
          marginBottom: '16px',
          padding: '8px',
          background: theme.colors.background.primary,
          borderRadius: '4px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: theme.colors.text.secondary }}>
          📍 Основное
        </div>
        <Field label="Название операции">
          <Input
            value={endpoint.operation}
            onChange={(e) => handleChange('operation', e.currentTarget.value)}
            placeholder="например: ask, new_thread, get_status"
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
          <Field label="HTTP метод">
            <Combobox
              value={methodOptions.find((opt) => opt.value === endpoint.method) || methodOptions[0]}
              options={methodOptions}
              onChange={(opt) => handleChange('method', opt?.value || 'POST')}
            />
          </Field>
          <Field label="Путь (можно с переменными)">
            <Input
              value={endpoint.path}
              onChange={(e) => handleChange('path', e.currentTarget.value)}
              placeholder="/{thread_id}/messages"
            />
          </Field>
        </div>
      </div>

      {/* Тело запроса */}
      <div
        style={{
          marginBottom: '16px',
          padding: '8px',
          background: theme.colors.background.primary,
          borderRadius: '4px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: theme.colors.text.secondary }}>
          📦 Тело запроса
        </div>
        <Field label="JSON шаблон">
          <TextArea
            value={endpoint.body || ''}
            onChange={(e) => handleChange('body', e.currentTarget.value)}
            placeholder='{"message": "{user_input}", "temperature": 0.7}'
            rows={3}
          />
        </Field>
        <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '4px' }}>
          Поддерживает переменные: {'{user_input}'}, {'{thread_id}'} и т.д.
        </div>
      </div>

      {/* Заголовки */}
      <div
        style={{
          marginBottom: '16px',
          padding: '8px',
          background: theme.colors.background.primary,
          borderRadius: '4px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: theme.colors.text.secondary }}>
          🔐 Заголовки
        </div>
        <Field label="HTTP заголовки (JSON)">
          <TextArea
            value={endpoint.headers || ''}
            onChange={(e) => handleChange('headers', e.currentTarget.value)}
            placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
            rows={2}
          />
        </Field>
      </div>

      {/* Работа с ответом */}
      <div
        style={{
          marginBottom: '16px',
          padding: '8px',
          background: theme.colors.background.primary,
          borderRadius: '4px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px', color: theme.colors.text.secondary }}>
          🔄 Работа с ответом
        </div>
        <Field label="Сохранить поля в контекст">
          <Input
            value={endpoint.saveToContext?.join(', ') || ''}
            onChange={(e) => handleSaveToContextChange(e.currentTarget.value)}
            placeholder="thread_id, session_id, user_id"
          />
        </Field>
        <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px', marginBottom: '12px' }}>
          Эти поля будут доступны в следующих запросах
        </div>
        <Field label="Поле с ответом чата">
          <Input
            value={endpoint.replyField || ''}
            onChange={(e) => handleChange('replyField', e.currentTarget.value)}
            placeholder="text, message, content"
          />
        </Field>
        <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px' }}>
          Если не указано, определяется автоматически
        </div>
      </div>

      {/* Polling */}
      <div style={{ padding: '8px', background: theme.colors.background.primary, borderRadius: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.text.secondary }}>
            ⏱ Ожидание результата (Polling)
          </div>
          <Switch
            value={endpoint.polling?.enabled || false}
            onChange={(e) => handlePollingChange(e.currentTarget.checked)}
          />
        </div>
        {endpoint.polling?.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <Field label="Интервал (мс)">
              <Input
                type="number"
                value={endpoint.polling?.intervalMs ?? 1000}
                onChange={(e) => handlePollingFieldChange('intervalMs', parseInt(e.currentTarget.value, 10))}
              />
            </Field>
            <Field label="Максимум попыток">
              <Input
                type="number"
                value={endpoint.polling?.maxAttempts ?? 10}
                onChange={(e) => handlePollingFieldChange('maxAttempts', parseInt(e.currentTarget.value, 10))}
              />
            </Field>
            <Field label="Поле статуса">
              <Input
                value={endpoint.polling?.statusField ?? 'status'}
                onChange={(e) => handlePollingFieldChange('statusField', e.currentTarget.value)}
              />
            </Field>
            <Field label="Значение успеха">
              <Input
                value={endpoint.polling?.successValue ?? 'completed'}
                onChange={(e) => handlePollingFieldChange('successValue', e.currentTarget.value)}
              />
            </Field>
            <Field label="Поле результата">
              <Input
                value={endpoint.polling?.resultField ?? 'result'}
                onChange={(e) => handlePollingFieldChange('resultField', e.currentTarget.value)}
              />
            </Field>
            <Field label="Retry HTTP статусы (опционально)">
              <Input
                value={endpoint.polling?.retryStatusCodes?.join(', ') || ''}
                onChange={(e) => {
                  const codes = e.currentTarget.value
                    .split(',')
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n));
                  handlePollingFieldChange('retryStatusCodes', codes);
                }}
                placeholder="202, 404, 409"
              />
            </Field>
            <div style={{ fontSize: '11px', color: theme.colors.text.disabled, marginTop: '-4px' }}>
              При получении этих HTTP-статусов опрос продолжится (ошибкой не считается).
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------
// AgentEditModal (модальное окно редактирования/создания)
// ----------------------------------------------
const AgentEditModal: React.FC<{
  isOpen: boolean;
  agent: AgentConfig | null;
  onDismiss: () => void;
  onSave: (agent: AgentConfig) => void;
}> = ({ isOpen, agent, onDismiss, onSave }) => {
  const [editedAgent, setEditedAgent] = useState<AgentConfig>(
    () =>
      agent || {
        name: '',
        api: '',
        default: false,
        config: '',
        headers: '',
        endpoints: [],
        workflow: [],
        startupOperation: '',
      }
  );

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);

  const updateField = (field: keyof AgentConfig, value: any) => {
    setEditedAgent((prev) => ({ ...prev, [field]: value }));
  };

  const addEndpoint = () => {
    const newEndpoint: EndpointConfig = {
      operation: '',
      method: 'POST',
      path: '',
      body: '',
      saveToContext: [],
      polling: { enabled: false },
      headers: '',
      replyField: '',
    };
    setEditedAgent((prev) => ({
      ...prev,
      endpoints: [...(prev.endpoints || []), newEndpoint],
    }));
  };

  const updateEndpoint = (index: number, updated: EndpointConfig) => {
    setEditedAgent((prev) => {
      const endpoints = [...(prev.endpoints || [])];
      endpoints[index] = updated;
      return { ...prev, endpoints };
    });
  };

  const removeEndpoint = (index: number) => {
    setEditedAgent((prev) => {
      const endpoints = [...(prev.endpoints || [])];
      endpoints.splice(index, 1);
      return { ...prev, endpoints };
    });
  };

  const handleSave = () => {
    onSave(editedAgent);
    onDismiss();
  };

  const operationOptions: Array<ComboboxOption<string>> = (editedAgent.endpoints || [])
    .map((ep) => ep.operation || '')
    .filter(Boolean)
    .map((value) => ({ label: value, value }));

  const selectedStartup = operationOptions.find((opt) => opt.value === editedAgent.startupOperation) || null;

  return (
    <Modal title={agent ? 'Редактировать агента' : 'Новый агент'} isOpen={isOpen} onDismiss={onDismiss}>
      <div style={{ marginBottom: '16px' }}>
        <Field label="Имя агента">
          <Input
            value={editedAgent.name}
            onChange={(e) => updateField('name', e.currentTarget.value)}
            placeholder="например: GPT-4"
          />
        </Field>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Field label="Базовый URL">
          <Input
            value={editedAgent.api}
            onChange={(e) => updateField('api', e.currentTarget.value)}
            placeholder="https://api.example.com"
          />
        </Field>
      </div>

      <Collapse
        label="Общая конфигурация (доп. параметры для всех запросов)"
        isOpen={isConfigOpen}
        onToggle={() => setIsConfigOpen(!isConfigOpen)}
      >
        <div style={{ marginTop: '12px' }}>
          <Field label="Параметры (JSON с переменными)">
            <TextArea
              value={editedAgent.config || ''}
              onChange={(e) => updateField('config', e.currentTarget.value)}
              placeholder='{"model": "gpt-4", "temperature": 0.7, "thread_id": "${thread_id}"}'
              rows={4}
            />
          </Field>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Эти параметры будут объединены с телом каждого запроса. Используйте {'${variable}'} для подстановки из
            контекста.
          </div>
        </div>
      </Collapse>

      <Collapse label="Общие заголовки" isOpen={isHeadersOpen} onToggle={() => setIsHeadersOpen(!isHeadersOpen)}>
        <div style={{ marginTop: '12px' }}>
          <Field label="Заголовки (JSON)">
            <TextArea
              value={editedAgent.headers || ''}
              onChange={(e) => updateField('headers', e.currentTarget.value)}
              placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
              rows={3}
            />
          </Field>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Будут добавлены к каждому запросу (если не переопределены в endpoint).
          </div>
        </div>
      </Collapse>

      <div style={{ marginBottom: '16px' }}>
        <Checkbox
          label="Агент по умолчанию"
          value={editedAgent.default}
          onChange={(e) => updateField('default', e.currentTarget.checked)}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Field label="Стартовая операция (выполняется при старте сессии)">
          <Combobox
            value={selectedStartup}
            options={operationOptions}
            onChange={(opt) => updateField('startupOperation', opt?.value || '')}
            placeholder="Не выбрана"
            isClearable
          />
        </Field>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Будет автоматически вызвана при создании нового чата.
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0 }}>Эндпоинты</h4>
          <Button icon="plus" onClick={addEndpoint} variant="secondary" size="sm">
            Добавить эндпоинт
          </Button>
        </div>
        {(editedAgent.endpoints || []).length === 0 && (
          <div style={{ color: '#999', fontStyle: 'italic', marginBottom: '8px' }}>
            Нет настроенных эндпоинтов. Добавьте хотя бы один.
          </div>
        )}
        {(editedAgent.endpoints || []).map((endpoint, epIdx) => (
          <EndpointEditor
            key={epIdx}
            endpoint={endpoint}
            index={epIdx}
            onChange={(i, updated) => updateEndpoint(i, updated)}
            onRemove={(i) => removeEndpoint(i)}
          />
        ))}
      </div>

      <div style={{ marginBottom: '16px', marginTop: '16px' }}>
        <Field label="Workflow (порядок операций через запятую)">
          <Input
            value={editedAgent.workflow ? editedAgent.workflow.join(', ') : ''}
            onChange={(e) => {
              const workflowStr = e.currentTarget.value;
              const workflow = workflowStr
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              updateField('workflow', workflow);
            }}
            placeholder="new_thread, ask, run_result"
          />
        </Field>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Имена операций (из списка эндпоинтов) в порядке выполнения.
        </div>
      </div>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

// ----------------------------------------------
// Основной компонент AgentsEditor
// ----------------------------------------------
export const AgentsEditor: React.FC<AgentsEditorProps> = ({ value = [], onChange }) => {
  const [agents, setAgents] = useState<AgentConfig[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const theme = useTheme2();

  const updateAgents = (newAgents: AgentConfig[]) => {
    setAgents(newAgents);
    onChange(newAgents);
  };

  const handleAdd = () => {
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleSave = (agent: AgentConfig) => {
    if (editingIndex === null) {
      let newAgents = [...agents, agent];
      if (agent.default) {
        newAgents = newAgents.map((a, i) => (i === newAgents.length - 1 ? a : { ...a, default: false }));
      }
      updateAgents(newAgents);
    } else {
      const newAgents = [...agents];
      newAgents[editingIndex] = agent;
      if (agent.default) {
        for (let i = 0; i < newAgents.length; i++) {
          if (i !== editingIndex) {
            newAgents[i] = { ...newAgents[i], default: false };
          }
        }
      }
      updateAgents(newAgents);
    }
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    const newAgents = agents.filter((_, i) => i !== index);
    if (agents[index].default && newAgents.length > 0) {
      newAgents[0] = { ...newAgents[0], default: true };
    }
    updateAgents(newAgents);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {agents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {agents.map((agent, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: theme.colors.background.primary,
                border: `1px solid ${theme.colors.border.weak}`,
                borderRadius: theme.shape.radius.default,
                padding: '12px 16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border.strong;
                e.currentTarget.style.background = theme.colors.background.secondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border.weak;
                e.currentTarget.style.background = theme.colors.background.primary;
              }}
            >
              <div
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}
              >
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name}
                </div>
                {agent.default && (
                  <div
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: theme.colors.primary.main,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    По умолчанию
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button
                  icon="edit"
                  onClick={() => handleEdit(idx)}
                  variant="secondary"
                  size="sm"
                  aria-label="Редактировать"
                />
                <Button
                  icon="trash-alt"
                  onClick={() => handleRemove(idx)}
                  variant="destructive"
                  size="sm"
                  aria-label="Удалить"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button icon="plus" onClick={handleAdd} variant="secondary" style={{ width: '100%' }}>
        Добавить агента
      </Button>

      <AgentEditModal
        key={editingIndex}
        isOpen={isModalOpen}
        agent={editingIndex !== null ? agents[editingIndex] : null}
        onDismiss={() => {
          setIsModalOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};
