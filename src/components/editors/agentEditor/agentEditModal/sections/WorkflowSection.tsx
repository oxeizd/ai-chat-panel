// WorkflowSection.tsx
import React, { useState } from 'react';
import {
  Field,
  Combobox,
  MultiCombobox,
  ComboboxOption,
  Checkbox,
  Input,
  RadioButtonGroup,
  TextArea,
} from '@grafana/ui';
import { HistoryListItemFields, HistoryMessageFields } from 'types';
import { CollapsibleSection } from 'components/editors/shared/CollapsibleSection';
import { PlainCollapsible } from 'components/editors/shared/PlainCollapsible';

type SuggestionsSource = 'static' | 'dynamic_once' | 'dynamic_per_reply';

interface WorkflowSectionProps {
  operationOptions: Array<ComboboxOption<string>>;
  startupOperation: string;
  workflow: string[];
  history: boolean;
  historyListOperation?: string;
  historyLoadOperation?: string;
  historyDeleteOperation?: string;
  threadIdContextKey?: string;
  threadIdParam?: string;
  historyListItemFields?: HistoryListItemFields;
  historyMessageFields?: HistoryMessageFields;
  suggestions?: string;
  suggestionsSource?: SuggestionsSource;
  dynamicSuggestionsContextKey?: string;
  suggestionsOperation?: string;
  onChangeStartup: (value: string) => void;
  onChangeWorkflow: (value: string[]) => void;
  onChangeHistory: (checked: boolean) => void;
  onChangeHistoryList: (value: string) => void;
  onChangeHistoryLoad: (value: string) => void;
  onChangeHistoryDelete: (value: string) => void;
  onChangeThreadIdContextKey: (value: string) => void;
  onChangeThreadIdParam: (value: string) => void;
  onChangeHistoryListItemFields: (value: HistoryListItemFields) => void;
  onChangeHistoryMessageFields: (value: HistoryMessageFields) => void;
  onChangeSuggestions: (value: string) => void;
  onChangeSuggestionsSource: (value: SuggestionsSource) => void;
  onChangeDynamicSuggestionsContextKey: (value: string) => void;
  onChangeSuggestionsOperation: (value: string) => void;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  operationOptions,
  startupOperation,
  workflow,
  history,
  historyListOperation,
  historyLoadOperation,
  historyDeleteOperation,
  threadIdContextKey,
  threadIdParam,
  historyListItemFields,
  historyMessageFields,
  suggestions,
  suggestionsSource,
  dynamicSuggestionsContextKey,
  suggestionsOperation,
  onChangeStartup,
  onChangeWorkflow,
  onChangeHistory,
  onChangeHistoryList,
  onChangeHistoryLoad,
  onChangeHistoryDelete,
  onChangeThreadIdContextKey,
  onChangeThreadIdParam,
  onChangeHistoryListItemFields,
  onChangeHistoryMessageFields,
  onChangeSuggestions,
  onChangeSuggestionsSource,
  onChangeDynamicSuggestionsContextKey,
  onChangeSuggestionsOperation,
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
  const selectedHistoryDelete = operationOptions.find((opt) => opt.value === historyDeleteOperation) || null;
  const selectedSuggestionsOperation = operationOptions.find((opt) => opt.value === suggestionsOperation) || null;

  const listFields = historyListItemFields || {};
  const msgFields = historyMessageFields || {};

  const updateListField = (key: keyof HistoryListItemFields, value: string) => {
    onChangeHistoryListItemFields({ ...listFields, [key]: value });
  };

  const updateMsgField = (key: keyof HistoryMessageFields, value: string) => {
    onChangeHistoryMessageFields({ ...msgFields, [key]: value });
  };

  const threadIdParamPlaceholder = threadIdContextKey || 'thread_id';

  const [useCustomSuggestions, setUseCustomSuggestions] = useState(
    !!(suggestions?.trim() || dynamicSuggestionsContextKey?.trim())
  );

  const handleToggleCustomSuggestions = (checked: boolean) => {
    setUseCustomSuggestions(checked);
    if (!checked) {
      onChangeSuggestions('');
      onChangeDynamicSuggestionsContextKey('');
      onChangeSuggestionsOperation('');
      onChangeSuggestionsSource('static');
    }
  };

  const effectiveSource: SuggestionsSource = suggestionsSource || 'static';
  const isDynamic = effectiveSource === 'dynamic_once' || effectiveSource === 'dynamic_per_reply';

  const operationDescription =
    effectiveSource === 'dynamic_once'
      ? 'Called once when a new chat session starts (panel load, agent switch, or "New chat"). Since no reply exists yet at that point, this operation is effectively required for this mode.'
      : "If set, this operation is called automatically right after every assistant reply (in the background, doesn't delay the reply itself). Leave empty if the send endpoint already returns suggestions in the same response.";

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
      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '16px' }}>
        Will be automatically called when a new chat is created.
      </div>

      <div style={{ marginBottom: '16px' }}>
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

      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Checkbox label="Enable History" value={history} onChange={(e) => onChangeHistory(e.currentTarget.checked)} />
        </div>

        <CollapsibleSection title="History settings" enabled={history} hideWhenDisabled>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <PlainCollapsible title="Operations" defaultCollapsed={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  description="Called with the parameter named below (see 'Thread ID mapping') equal to the selected thread id."
                >
                  <Combobox
                    value={selectedHistoryLoad}
                    options={operationOptions}
                    onChange={(opt) => onChangeHistoryLoad(opt?.value || '')}
                    placeholder="Select operation"
                    isClearable
                  />
                </Field>

                <Field
                  label="Delete history thread (optional)"
                  description="If not set, deleting a chat from the History modal only removes it from the visible list, without calling the backend."
                >
                  <Combobox
                    value={selectedHistoryDelete}
                    options={operationOptions}
                    onChange={(opt) => onChangeHistoryDelete(opt?.value || '')}
                    placeholder="Not configured"
                    isClearable
                  />
                </Field>
              </div>
            </PlainCollapsible>

            <PlainCollapsible title="Thread ID mapping" defaultCollapsed={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field
                  label="Context key"
                  description="Name of the context key where the agent's thread/chat id is stored after sending a message (usually filled via saveToContext on the send endpoint). Default: thread_id."
                >
                  <Input
                    value={threadIdContextKey ?? ''}
                    placeholder="thread_id"
                    onChange={(e) => onChangeThreadIdContextKey(e.currentTarget.value)}
                  />
                </Field>

                <Field
                  label="Request parameter name (optional)"
                  description={
                    <>
                      Name of the parameter passed to Load/Delete operations. Leave empty to reuse the &quot;Context
                      key&quot; value above.
                    </>
                  }
                >
                  <Input
                    value={threadIdParam ?? ''}
                    placeholder={threadIdParamPlaceholder}
                    onChange={(e) => onChangeThreadIdParam(e.currentTarget.value)}
                  />
                </Field>
              </div>
            </PlainCollapsible>

            <PlainCollapsible
              title="Thread list item fields (advanced)"
              description="Dot-path fields for each item returned by the List operation."
              defaultCollapsed
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field label="id">
                  <Input
                    value={listFields.id ?? ''}
                    placeholder="id"
                    onChange={(e) => updateListField('id', e.currentTarget.value)}
                  />
                </Field>
                <Field label="title">
                  <Input
                    value={listFields.title ?? ''}
                    placeholder="title"
                    onChange={(e) => updateListField('title', e.currentTarget.value)}
                  />
                </Field>
                <Field label="date">
                  <Input
                    value={listFields.date ?? ''}
                    placeholder="date"
                    onChange={(e) => updateListField('date', e.currentTarget.value)}
                  />
                </Field>
                <Field label="preview (optional)">
                  <Input
                    value={listFields.preview ?? ''}
                    placeholder="preview"
                    onChange={(e) => updateListField('preview', e.currentTarget.value)}
                  />
                </Field>
              </div>
            </PlainCollapsible>

            <PlainCollapsible
              title="Thread message fields (advanced)"
              description={
                <>
                  Dot-path fields for each message returned by the Load operation. &quot;text&quot; might be called{' '}
                  <code>content</code>, <code>text</code>, <code>message</code>, etc. depending on your backend — set it
                  explicitly, the default is only a guess.
                </>
              }
              defaultCollapsed
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field label="role">
                  <Input
                    value={msgFields.role ?? ''}
                    placeholder="role"
                    onChange={(e) => updateMsgField('role', e.currentTarget.value)}
                  />
                </Field>
                <Field label="text">
                  <Input
                    value={msgFields.text ?? ''}
                    placeholder="content"
                    onChange={(e) => updateMsgField('text', e.currentTarget.value)}
                  />
                </Field>
                <Field label="id (optional)">
                  <Input
                    value={msgFields.id ?? ''}
                    placeholder="id"
                    onChange={(e) => updateMsgField('id', e.currentTarget.value)}
                  />
                </Field>
                <Field label="timestamp (optional)">
                  <Input
                    value={msgFields.timestamp ?? ''}
                    placeholder="timestamp"
                    onChange={(e) => updateMsgField('timestamp', e.currentTarget.value)}
                  />
                </Field>
              </div>
            </PlainCollapsible>
          </div>
        </CollapsibleSection>
      </div>

      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Checkbox
            label="Custom suggestions"
            value={useCustomSuggestions}
            onChange={(e) => handleToggleCustomSuggestions(e.currentTarget.checked)}
          />
        </div>

        <CollapsibleSection title="Suggestions settings" enabled={useCustomSuggestions} hideWhenDisabled>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="Source">
              <RadioButtonGroup
                options={[
                  { label: 'Static text', value: 'static' },
                  { label: 'Once, on load', value: 'dynamic_once' },
                  { label: 'After every reply', value: 'dynamic_per_reply' },
                ]}
                value={effectiveSource}
                onChange={(v) => onChangeSuggestionsSource((v as SuggestionsSource) || 'static')}
              />
            </Field>

            {!isDynamic ? (
              <Field label="Suggestions" description="Separator: ; . Used instead of the panel's shared suggestions.">
                <TextArea
                  value={suggestions ?? ''}
                  onChange={(e) => onChangeSuggestions(e.currentTarget.value)}
                  placeholder="Что ты умеешь?;Покажи пример;Помоги с отчётом"
                  rows={2}
                />
              </Field>
            ) : (
              <>
                <Field label="Suggestions operation" description={operationDescription}>
                  <Combobox
                    value={selectedSuggestionsOperation}
                    options={operationOptions}
                    onChange={(opt) => onChangeSuggestionsOperation(opt?.value || '')}
                    placeholder="Not configured"
                    isClearable
                  />
                </Field>

                <Field
                  label="Context key"
                  description={
                    <>
                      Name of the context key holding the suggestions. Populate it via <code>saveToContext</code> —
                      either on the send endpoint (if it returns suggestions inline, only relevant for &quot;After every
                      reply&quot;) or on the &quot;Suggestions operation&quot; above. Accepts an array of strings or a
                      &quot;;&quot;-separated string.
                    </>
                  }
                >
                  <Input
                    value={dynamicSuggestionsContextKey ?? ''}
                    placeholder="suggestions"
                    onChange={(e) => onChangeDynamicSuggestionsContextKey(e.currentTarget.value)}
                  />
                </Field>
              </>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
};
