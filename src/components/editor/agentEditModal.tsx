import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Input,
  TextArea,
  Checkbox,
  Modal,
  Field,
  Combobox,
  Collapse,
  MultiCombobox,
  ComboboxOption,
} from '@grafana/ui';
import { AgentConfig, EndpointConfig } from 'types';
import { EndpointEditor, EndpointEditorHandle } from './endpointEditor';

interface AgentEditModalProps {
  isOpen: boolean;
  agent: AgentConfig | null;
  onDismiss: () => void;
  onSave: (agent: AgentConfig) => void;
}

const emptyAgent = (): AgentConfig => ({
  name: '',
  api: '',
  default: false,
  config: {},
  headers: {},
  endpoints: [],
  workflow: [],
  startupOperation: '',
});

export const AgentEditModal: React.FC<AgentEditModalProps> = ({ isOpen, agent, onDismiss, onSave }) => {
  const [editedAgent, setEditedAgent] = useState<AgentConfig>(emptyAgent());
  const [configStr, setConfigStr] = useState('');
  const [headersStr, setHeadersStr] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [isCommonOpen, setIsCommonOpen] = useState(false);

  const endpointRefs = useRef<Array<EndpointEditorHandle | null>>([]);

  useEffect(() => {
    if (agent) {
      setEditedAgent(agent);
      setConfigStr(agent.config ? JSON.stringify(agent.config, null, 2) : '');
      setHeadersStr(agent.headers ? JSON.stringify(agent.headers, null, 2) : '');
    } else {
      setEditedAgent(emptyAgent());
      setConfigStr('');
      setHeadersStr('');
    }
    setConfigError(null);
    setHeadersError(null);
    endpointRefs.current = [];
  }, [agent]);

  const updateField = (field: keyof AgentConfig, value: any) => {
    setEditedAgent((prev) => ({ ...prev, [field]: value }));
  };

  // Config (общее тело)
  const handleConfigChange = (value: string) => {
    setConfigStr(value);
    if (value.trim() === '') {
      setConfigError(null);
      return;
    }
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setConfigError(errorMessage);
    }
  };

  const handleConfigBlur = () => {
    const value = configStr.trim();
    if (value === '') {
      setConfigError(null);
      updateField('config', {});
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Config must be a JSON object');
      }
      setConfigError(null);
      updateField('config', parsed);
    } catch (err) {
      // ошибка уже показана
    }
  };

  // Headers (общие заголовки)
  const handleHeadersChange = (value: string) => {
    setHeadersStr(value);
    if (value.trim() === '') {
      setHeadersError(null);
      return;
    }
    try {
      JSON.parse(value);
      setHeadersError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setHeadersError(errorMessage);
    }
  };

  const handleHeadersBlur = () => {
    const value = headersStr.trim();
    if (value === '') {
      setHeadersError(null);
      updateField('headers', {});
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Headers must be a JSON object');
      }
      setHeadersError(null);
      updateField('headers', parsed);
    } catch (err) {
      // ошибка уже показана
    }
  };

  const addEndpoint = () => {
    const newEndpoint: EndpointConfig = {
      operation: '',
      method: 'POST',
      path: '',
      body: {},
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
    const updatedEndpoints = editedAgent.endpoints.map((ep, idx) => {
      const ref = endpointRefs.current[idx];
      if (ref) {
        const { body, headers } = ref.getCurrentValue();
        return { ...ep, body, headers };
      }
      return ep;
    });

    let agentToSave = { ...editedAgent, endpoints: updatedEndpoints };
    if (configError) {
      agentToSave.config = {};
    }
    if (headersError) {
      agentToSave.headers = {};
    }
    if (!agentToSave.config) {
      agentToSave.config = {};
    }
    if (!agentToSave.headers) {
      agentToSave.headers = {};
    }

    onSave(agentToSave);
    onDismiss();
  };

  // Опции для операций (на основе существующих endpoint.operation) - используем ComboboxOption
  const operationOptions: Array<ComboboxOption<string>> = (editedAgent.endpoints || [])
    .map((ep) => ep.operation || '')
    .filter(Boolean)
    .map((value) => ({ label: value, value }));

  const selectedStartup = operationOptions.find((opt) => opt.value === editedAgent.startupOperation) || null;

  // Мультиселект для workflow с использованием MultiCombobox
  const selectedWorkflow: Array<ComboboxOption<string>> = (editedAgent.workflow || [])
    .map((op) => operationOptions.find((opt) => opt.value === op))
    .filter((opt): opt is ComboboxOption<string> => opt !== undefined);

  const handleWorkflowChange = (selected: Array<ComboboxOption<string>>) => {
    const workflow = selected.map((opt) => opt.value).filter(Boolean) as string[];
    updateField('workflow', workflow);
  };

  return (
    <Modal title={agent ? 'Edit Agent' : 'New Agent'} isOpen={isOpen} onDismiss={onDismiss}>
      <div style={{ marginBottom: '12px' }}>
        <Field label="Name">
          <Input
            value={editedAgent.name}
            onChange={(e) => updateField('name', e.currentTarget.value)}
            placeholder="e.g.: GPT-4"
          />
        </Field>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Field label="Base URL">
          <Input
            value={editedAgent.api}
            onChange={(e) => updateField('api', e.currentTarget.value)}
            placeholder="https://api.example.com"
          />
        </Field>
      </div>

      {/* Единый Collapse для общих заголовков и тела */}
      <Collapse label="Common configuration" isOpen={isCommonOpen} onToggle={() => setIsCommonOpen(!isCommonOpen)}>
        <div style={{ marginTop: '8px' }}>
          <Field label="Headers" invalid={!!headersError} error={headersError}>
            <TextArea
              value={headersStr}
              onChange={(e) => handleHeadersChange(e.currentTarget.value)}
              onBlur={handleHeadersBlur}
              placeholder='{"Authorization": "Bearer token"}'
              rows={3}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Field>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '16px' }}>
            These headers will be added to every request (unless overridden in the endpoint).
          </div>

          <Field label="Parameters (JSON object with variables)" invalid={!!configError} error={configError}>
            <TextArea
              value={configStr}
              onChange={(e) => handleConfigChange(e.currentTarget.value)}
              onBlur={handleConfigBlur}
              placeholder='{"model": "gpt-4", "temperature": 0.7, "id": "${id}"}'
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Field>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
            These parameters will be merged with each request body. Use {'${variable}'} for substitution from context.
          </div>
        </div>
      </Collapse>

      <div style={{ marginBottom: '16px' }}>
        <Checkbox
          label="Use by default"
          value={editedAgent.default}
          onChange={(e) => updateField('default', e.currentTarget.checked)}
        />
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0 }}>Endpoints</h4>
          <Button icon="plus" onClick={addEndpoint} variant="secondary" size="sm">
            Add endpoint
          </Button>
        </div>
        {(editedAgent.endpoints || []).length === 0 && (
          <div style={{ color: '#999', marginBottom: '8px', fontSize: '12px' }}>No endpoints configured</div>
        )}
        {(editedAgent.endpoints || []).map((endpoint, epIdx) => (
          <EndpointEditor
            key={epIdx}
            ref={(el) => (endpointRefs.current[epIdx] = el)}
            endpoint={endpoint}
            index={epIdx}
            onChange={updateEndpoint}
            onRemove={removeEndpoint}
          />
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Field label="Startup operation (executed when session starts)">
          <Combobox
            value={selectedStartup}
            options={operationOptions}
            onChange={(opt) => updateField('startupOperation', opt?.value || '')}
            placeholder="Not selected"
            isClearable
          />
        </Field>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Will be automatically called when a new chat is created.
        </div>
      </div>

      <div style={{ marginBottom: '16px', marginTop: '16px' }}>
        <Field label="Workflow (order of operations)">
          <MultiCombobox
            options={operationOptions}
            value={selectedWorkflow}
            onChange={handleWorkflowChange}
            placeholder="Select operations..."
            isClearable
          />
        </Field>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          Operations will be executed in the selected order.
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
