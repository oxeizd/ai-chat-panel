import React from 'react';
import { Field, Combobox, MultiCombobox, ComboboxOption } from '@grafana/ui';

interface WorkflowSectionProps {
  operationOptions: Array<ComboboxOption<string>>;
  startupOperation: string;
  workflow: string[];
  onChangeStartup: (value: string) => void;
  onChangeWorkflow: (value: string[]) => void;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  operationOptions,
  startupOperation,
  workflow,
  onChangeStartup,
  onChangeWorkflow,
}) => {
  const selectedStartup = operationOptions.find((opt) => opt.value === startupOperation) || null;

  const selectedWorkflow: Array<ComboboxOption<string>> = workflow
    .map((op) => operationOptions.find((opt) => opt.value === op))
    .filter((opt): opt is ComboboxOption<string> => opt !== undefined);

  const handleWorkflowChange = (selected: Array<ComboboxOption<string>>) => {
    const values = selected.map((opt) => opt.value).filter(Boolean);
    onChangeWorkflow(values);
  };

  return (
    <>
      <Field label="Startup operation (executed when session starts)">
        <Combobox
          value={selectedStartup}
          options={operationOptions}
          onChange={(opt) => onChangeStartup(opt?.value || '')}
          placeholder="Not selected"
          isClearable
        />
      </Field>
      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
        Will be automatically called when a new chat is created.
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
    </>
  );
};
