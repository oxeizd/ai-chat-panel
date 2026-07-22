// WorkflowSection.tsx
import React from 'react';
import { Field, Combobox, MultiCombobox, ComboboxOption, Checkbox } from '@grafana/ui';

interface WorkflowSectionProps {
  operationOptions: Array<ComboboxOption<string>>;
  startupOperation: string;
  workflow: string[];
  history: boolean;
  historyListOperation?: string;
  historyLoadOperation?: string;
  onChangeStartup: (value: string) => void;
  onChangeWorkflow: (value: string[]) => void;
  onChangeHistory: (checked: boolean) => void;
  onChangeHistoryList: (value: string) => void;
  onChangeHistoryLoad: (value: string) => void;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  operationOptions,
  startupOperation,
  workflow,
  history,
  historyListOperation,
  historyLoadOperation,
  onChangeStartup,
  onChangeWorkflow,
  onChangeHistory,
  onChangeHistoryList,
  onChangeHistoryLoad,
}) => {
  const selectedStartup = operationOptions.find((opt) => opt.value === startupOperation) || null;
  const selectedWorkflow = workflow
    .map((op) => operationOptions.find((opt) => opt.value === op))
    .filter((opt): opt is ComboboxOption<string> => opt !== undefined);

  const handleWorkflowChange = (selected: Array<ComboboxOption<string>>) => {
    const values = selected.map((opt) => opt.value).filter(Boolean);
    onChangeWorkflow(values);
  };

  const selectedHistoryList = operationOptions.find((opt) => opt.value === historyListOperation) || null;
  const selectedHistoryLoad = operationOptions.find((opt) => opt.value === historyLoadOperation) || null;

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

      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Checkbox label="Enable History" value={history} onChange={(e) => onChangeHistory(e.currentTarget.checked)} />
        </div>
        {history && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="List history threads (operation to get threads list)">
              <Combobox
                value={selectedHistoryList}
                options={operationOptions}
                onChange={(opt) => onChangeHistoryList(opt?.value || '')}
                placeholder="Select operation"
                isClearable
              />
            </Field>
            <Field
              label="Load history thread (operation to load messages of a thread)"
              description={
                <>
                  This operation will be called with <code>{'{chatId}'}</code> variable.
                </>
              }
            >
              <Combobox
                value={selectedHistoryLoad}
                options={operationOptions}
                onChange={(opt) => onChangeHistoryLoad(opt?.value || '')}
                placeholder="Select operation"
                isClearable
              />
            </Field>
          </div>
        )}
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
