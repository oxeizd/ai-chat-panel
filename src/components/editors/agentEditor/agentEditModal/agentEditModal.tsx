import React, { useState, useRef } from 'react';
import { Button, Modal, ComboboxOption, useTheme2 } from '@grafana/ui';
import { AgentConfig } from 'types';
import { EndpointEditorHandle } from '../endpointEditor/endpointEditor';
import { EndpointsSection } from './sections/EndpointsSection';
import { AgentCommonSection } from './sections/AgentCommonSection';
import { WorkflowSection } from './sections/WorkflowSection';

interface AgentEditModalProps {
  isOpen: boolean;
  agent: AgentConfig | null;
  onDismiss: () => void;
  onSave: (agent: AgentConfig) => void;
  existingAgents: AgentConfig[];
}

const emptyAgent = (): AgentConfig => ({
  name: '',
  api: '',
  default: false,
  endpoints: [],
  workflow: [],
  startupOperation: '',
});

export const AgentEditModal: React.FC<AgentEditModalProps> = ({ isOpen, agent, onDismiss, onSave, existingAgents }) => {
  const theme = useTheme2();

  const endpointRefs = useRef<Array<EndpointEditorHandle | null>>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [editedAgent, setEditedAgent] = useState<AgentConfig>(() => (agent ? { ...agent } : emptyAgent()));

  const updateField = (field: keyof AgentConfig, value: any) => {
    setEditedAgent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!editedAgent.name.trim()) {
      setValidationError('Agent name is required');
      return;
    }
    if (!editedAgent.api.trim()) {
      setValidationError('Base URL is required');
      return;
    }

    const nameExists = existingAgents.some((a) => a.name === editedAgent.name && a !== agent);
    if (nameExists) {
      setValidationError('An agent with this name already exists');
      return;
    }

    setValidationError(null);

    const operations = editedAgent.endpoints.map((ep) => ep.operation?.trim()).filter(Boolean);
    const uniqueOperations = new Set(operations);
    if (operations.length !== uniqueOperations.size) {
      setValidationError('Operation names must be unique within an agent');
      return;
    }

    const updatedEndpoints = editedAgent.endpoints.map((ep, idx) => {
      const ref = endpointRefs.current[idx];
      if (ref) {
        const { body, headers } = ref.getCurrentValue();
        return { ...ep, body, headers };
      }
      return ep;
    });

    let agentToSave = { ...editedAgent, endpoints: updatedEndpoints };

    onSave(agentToSave);
    onDismiss();
  };

  // Опции для операций (на основе существующих endpoint.operation) - используем ComboboxOption
  const operationOptions: Array<ComboboxOption<string>> = (editedAgent.endpoints || [])
    .map((ep) => ep.operation || '')
    .filter(Boolean)
    .map((value) => ({ label: value, value }));

  return (
    <Modal title={agent ? 'Edit Agent' : 'New Agent'} isOpen={isOpen} onDismiss={onDismiss}>
      {/* name, url, use by deafult */}
      <AgentCommonSection agent={editedAgent} onChange={updateField} />

      <EndpointsSection
        endpoints={editedAgent.endpoints || []}
        onChange={(newEndpoints) => updateField('endpoints', newEndpoints)}
        endpointRefs={endpointRefs}
      />

      <WorkflowSection
        operationOptions={operationOptions}
        startupOperation={editedAgent.startupOperation || ''}
        workflow={editedAgent.workflow || []}
        onChangeStartup={(value) => updateField('startupOperation', value)}
        onChangeWorkflow={(value) => updateField('workflow', value)}
      />

      {validationError && <div style={{ color: theme.colors.error.main, marginBottom: '12px' }}>{validationError}</div>}

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
