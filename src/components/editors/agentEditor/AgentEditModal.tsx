import React, { useState } from 'react';
import { Button, Input, TextArea, Checkbox, Modal, Field, Combobox, Collapse } from '@grafana/ui';
import { AgentConfig, EndpointConfig } from 'types';
import { EndpointEditor } from './EndpointEditor';

interface AgentEditModalProps {
  isOpen: boolean;
  agent: AgentConfig | null;
  onDismiss: () => void;
  onSave: (agent: AgentConfig) => void;
}

export const AgentEditModal: React.FC<AgentEditModalProps> = ({ isOpen, agent, onDismiss, onSave }) => {
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

  const operationOptions = (editedAgent.endpoints || [])
    .map((ep) => ep.operation || '')
    .filter(Boolean)
    .map((value) => ({ label: value, value }));

  const selectedStartup = operationOptions.find((opt) => opt.value === editedAgent.startupOperation) || null;

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

      <Collapse label="Common headers" isOpen={isHeadersOpen} onToggle={() => setIsHeadersOpen(!isHeadersOpen)}>
        <div style={{ marginTop: '8px' }}>
          <Field label="Headers (JSON)">
            <TextArea
              value={editedAgent.headers || ''}
              onChange={(e) => updateField('headers', e.currentTarget.value)}
              placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
              rows={2}
            />
          </Field>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '4px' }}>
            These headers will be added to every request (unless overridden in the endpoint).
          </div>
        </div>
      </Collapse>

      <Collapse
        label="Common body (additional parameters for all requests)"
        isOpen={isConfigOpen}
        onToggle={() => setIsConfigOpen(!isConfigOpen)}
      >
        <div style={{ marginTop: '8px' }}>
          <Field label="Parameters (JSON with variables)">
            <TextArea
              value={editedAgent.config || ''}
              onChange={(e) => updateField('config', e.currentTarget.value)}
              placeholder='{"model": "gpt-4", "temperature": 0.7, "id": "${id}"}'
              rows={3}
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
            endpoint={endpoint}
            index={epIdx}
            onChange={(i, updated) => updateEndpoint(i, updated)}
            onRemove={(i) => removeEndpoint(i)}
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
        <Field label="Workflow (comma-separated operation order)">
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
          Operation names (from the endpoint list) in execution order.
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
