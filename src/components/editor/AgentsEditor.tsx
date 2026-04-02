import React, { useState, useEffect } from 'react';
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
import { AgentConfig, EndpointConfig, PollingConfig } from 'types';

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

  const handleHeadersChange = (val: string) => {
    try {
      const headers = val.trim() ? JSON.parse(val) : {};
      handleChange('headers', headers);
    } catch (e) {
      console.warn('Invalid JSON in headers, ignoring');
    }
  };

  const handlePollingChange = (enabled: boolean) => {
    const currentPolling = endpoint.polling || {};
    handleChange('polling', { ...currentPolling, enabled });
  };

  const handlePollingFieldChange = (field: keyof PollingConfig, val: any) => {
    const current = endpoint.polling || { enabled: false };
    handleChange('polling', { ...current, [field]: val });
  };

  const headersString = endpoint.headers ? JSON.stringify(endpoint.headers, null, 2) : '';

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <strong>Endpoint #{index + 1}</strong>
        <Button
          variant="destructive"
          size="sm"
          icon="trash-alt"
          onClick={() => onRemove(index)}
          aria-label="Delete endpoint"
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <Input
          label="Operation name"
          value={endpoint.operation}
          onChange={(e) => handleChange('operation', e.currentTarget.value)}
          placeholder="e.g., ask, new_thread, chat_messages"
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <Field label="HTTP method">
          <Combobox
            value={methodOptions.find((opt) => opt.value === endpoint.method) || methodOptions[0]}
            options={methodOptions}
            onChange={(opt) => handleChange('method', opt?.value || 'POST')}
          />
        </Field>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <Input
          label="Path (with variables like {thread_id})"
          value={endpoint.path}
          onChange={(e) => handleChange('path', e.currentTarget.value)}
          placeholder="/{thread_id}/ask"
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <TextArea
          label="Request body (JSON template, optional)"
          value={endpoint.body || ''}
          onChange={(e) => handleChange('body', e.currentTarget.value)}
          placeholder='{"message": "{user_input}"}'
          rows={2}
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <TextArea
          label="Headers (JSON, optional)"
          value={headersString}
          onChange={(e) => handleHeadersChange(e.currentTarget.value)}
          placeholder='{"Authorization": "Bearer token"}'
          rows={3}
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <Input
          label="Save fields to context (comma-separated)"
          value={endpoint.saveToContext?.join(', ') || ''}
          onChange={(e) => handleSaveToContextChange(e.currentTarget.value)}
          placeholder="thread_id, run_id, session_id"
        />
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Specify field names to extract from response and save for subsequent steps.
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <Input
          label="Reply field (optional)"
          value={endpoint.replyField || ''}
          onChange={(e) => handleChange('replyField', e.currentTarget.value)}
          placeholder="e.g., text, message, answer"
        />
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Specify which field in the response contains the chat reply. If empty, auto-detection is used.
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Switch
            label="Polling"
            value={endpoint.polling?.enabled || false}
            onChange={(e) => handlePollingChange(e.currentTarget.checked)}
          />
        </div>
        {endpoint.polling?.enabled && (
          <div style={{ marginLeft: '24px', marginTop: '8px' }}>
            <div style={{ marginBottom: '8px' }}>
              <Input
                label="Interval (ms)"
                type="number"
                value={endpoint.polling?.intervalMs ?? 1000}
                onChange={(e) => handlePollingFieldChange('intervalMs', parseInt(e.currentTarget.value, 10))}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <Input
                label="Max attempts"
                type="number"
                value={endpoint.polling?.maxAttempts ?? 10}
                onChange={(e) => handlePollingFieldChange('maxAttempts', parseInt(e.currentTarget.value, 10))}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <Input
                label="Status field"
                value={endpoint.polling?.statusField ?? 'status'}
                onChange={(e) => handlePollingFieldChange('statusField', e.currentTarget.value)}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <Input
                label="Success value"
                value={endpoint.polling?.successValue ?? 'completed'}
                onChange={(e) => handlePollingFieldChange('successValue', e.currentTarget.value)}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <Input
                label="Result field"
                value={endpoint.polling?.resultField ?? 'result'}
                onChange={(e) => handlePollingFieldChange('resultField', e.currentTarget.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AgentEditModal: React.FC<{
  isOpen: boolean;
  agent: AgentConfig | null;
  onDismiss: () => void;
  onSave: (agent: AgentConfig) => void;
}> = ({ isOpen, agent, onDismiss, onSave }) => {
  const [editedAgent, setEditedAgent] = useState<AgentConfig>(
    agent || {
      name: '',
      api: '',
      default: false,
      config: '',
      endpoints: [],
      workflow: [],
      startupOperation: '',
    }
  );

  const [isConfigOpen, setIsConfigOpen] = useState(false); // состояние для Collapse

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditedAgent(
      agent || {
        name: '',
        api: '',
        default: false,
        config: '',
        endpoints: [],
        workflow: [],
        startupOperation: '',
      }
    );
    setIsConfigOpen(false);
  }, [agent]);

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
      headers: {},
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
    <Modal title={agent ? 'Edit Agent' : 'New Agent'} isOpen={isOpen} onDismiss={onDismiss}>
      <div style={{ marginBottom: '16px' }}>
        <Input
          label="Agent Name"
          value={editedAgent.name}
          onChange={(e) => updateField('name', e.currentTarget.value)}
          placeholder="e.g., GPT-4"
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Input
          label="Base URL"
          value={editedAgent.api}
          onChange={(e) => updateField('api', e.currentTarget.value)}
          placeholder="https://api.example.com"
        />
      </div>

      <Collapse
        label="Additional Configuration (optional)"
        isOpen={isConfigOpen}
        onToggle={() => setIsConfigOpen(!isConfigOpen)}
      >
        <div style={{ marginTop: '12px' }}>
          <TextArea
            label="General Configuration (JSON)"
            value={editedAgent.config || ''}
            onChange={(e) => updateField('config', e.currentTarget.value)}
            placeholder='{"temperature": 0.7, "model": "gpt-4"}'
            rows={3}
          />
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Optional. Used to pass common parameters to all requests.
          </div>
        </div>
      </Collapse>

      <div style={{ marginBottom: '16px', marginTop: '16px' }}>
        <Checkbox
          label="Default Agent"
          value={editedAgent.default}
          onChange={(e) => updateField('default', e.currentTarget.checked)}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Field label="Startup Operation (executed when session starts)">
          <Combobox
            value={selectedStartup}
            options={operationOptions}
            onChange={(opt) => updateField('startupOperation', opt?.value || '')}
            placeholder="Not selected"
            isClearable
          />
        </Field>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Select an operation to run automatically when a new chat is created. Click cross to clear.
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0 }}>Endpoints</h4>
          <Button icon="plus" onClick={addEndpoint} variant="secondary" size="sm">
            Add Endpoint
          </Button>
        </div>
        {(editedAgent.endpoints || []).length === 0 && (
          <div style={{ color: '#999', fontStyle: 'italic', marginBottom: '8px' }}>
            No endpoints configured. Add at least one to interact with the agent.
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
        <Input
          label="Workflow (comma-separated operation order)"
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
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Specify operation names (from endpoints list) in execution order.
        </div>
      </div>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export const AgentsEditor: React.FC<AgentsEditorProps> = ({ value = [], onChange }) => {
  const [agents, setAgents] = useState<AgentConfig[]>(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
        // Создаём копии, чтобы не мутировать
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
      {agents.map((agent, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 12px',
            marginBottom: '8px',
          }}
        >
          <div>
            <strong>{agent.name}</strong>
            {agent.default && <span style={{ marginLeft: '8px', color: '#007bff' }}>(default)</span>}
          </div>
          <div>
            <Button
              icon="edit"
              onClick={() => handleEdit(idx)}
              variant="secondary"
              size="sm"
              style={{ marginRight: '8px' }}
              aria-label="Edit agent"
            />
            <Button
              icon="trash-alt"
              onClick={() => handleRemove(idx)}
              variant="destructive"
              size="sm"
              aria-label="Delete agent"
            />
          </div>
        </div>
      ))}
      <Button icon="plus" onClick={handleAdd} variant="secondary">
        Add Agent
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
