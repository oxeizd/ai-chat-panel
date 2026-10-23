import React from 'react';
import { Button, Field, Input, Combobox, Label, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig, StreamingConfig, StreamEventHandler } from 'types';
import { Toggle } from 'components/editors/shared/Toggle';
import { DEFAULT_STREAMING } from 'components/agent/config/defaults';

interface StreamingSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

const PARSE_STRATEGY_OPTIONS = [
  { label: 'SSE (Server-Sent Events)', value: 'sse' },
  { label: 'JSON Lines (jsonl)', value: 'jsonl' },
];

const EXTRACTION_MODE_OPTIONS = [
  { label: 'JSON path (dot notation)', value: 'jsonpath' },
  { label: 'Event type + field', value: 'eventfield' },
];

const RENDER_OPTIONS = [
  { label: 'chart — график под сообщением', value: 'chart' },
  { label: 'text — текст ответа', value: 'text' },
  { label: 'code — блок кода', value: 'code' },
  { label: 'context — в контекст сессии', value: 'context' },
  { label: 'error — ошибка потока', value: 'error' },
  { label: 'ignore — игнорировать', value: 'ignore' },
];

function makeDefaultRule(): StreamEventHandler {
  return { eventType: 'CUSTOM', render: 'chart', eventName: 'graph', valuePath: 'value' };
}

/**
 * Стартовые правила для AG-UI потока. Включают матчинг по ПОЛНОМУ имени события
 * (eventTypeField: 'type'), чтобы правило CUSTOM не перехватывало TEXT_MESSAGE_CONTENT
 * и другие текстовые события (иначе их delta теряется из ответа).
 *
 * Важно про дубли графиков: у события вида {type:"CUSTOM", chart:{...}} (без поля
 * name/value) правило с eventName:'graph' его НЕ матчит, и в дело вступает fallback
 * в processCustomEvent — он даёт ровно один график. Если же добавить второе правило
 * без eventName (chart), оно матчнётся ПЕРВЫМ и вернёт undefined по valuePath:'value',
 * т.е. графики без name перестанут рендериться вовсе. Поэтому в пресете — только
 * правило для именованных событий {name:'graph', value:{...}}.
 */
function makeAguiRules(): StreamEventHandler[] {
  return [
    {
      eventType: 'CUSTOM',
      render: 'chart',
      eventName: 'graph',
      valuePath: 'value',
      eventTypeField: 'type',
    },
    {
      eventType: 'RUN_ERROR',
      render: 'error',
      eventTypeField: 'type',
      valuePath: 'message',
    },
  ];
}

/** Пресеты «быстрого старта» для кнопки «AG-UI». */
const AG_UI_PRESETS: Array<{ label: string; build: () => Record<string, any> }> = [
  {
    label: 'AG-UI: графики + ошибки (рекомендуется)',
    build: () => ({ customEvents: makeAguiRules(), paragraphBetweenMessages: true }),
  },
  {
    label: 'AG-UI: только графики',
    build: () => ({ customEvents: [makeAguiRules()[0]], paragraphBetweenMessages: true }),
  },
  {
    label: 'AG-UI: только обработка RUN_ERROR',
    build: () => ({ customEvents: [makeAguiRules()[1]] }),
  },
];

function getDefaultConfig(strategy: 'sse' | 'jsonl'): StreamingConfig & { enabled: true } {
  if (strategy === 'sse') {
    return {
      enabled: true,
      parseStrategy: 'sse',
      // AG-UI по умолчанию: извлечение текста по типу события + граница сообщений.
      textEventType: 'TEXT_MESSAGE_CONTENT',
      textDeltaField: 'delta',
      paragraphBetweenMessages: true,
      customEvents: makeAguiRules(),
    };
  }
  return {
    enabled: true,
    parseStrategy: 'jsonl',
    textPath: DEFAULT_STREAMING.textPath,
  };
}

const getStyles = () => ({
  container: css`
    margin-top: 16px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `,
  fields: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  `,
  ruleCard: css`
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  ruleHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  ruleRow: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    & > * {
      flex: 1 1 140px;
      min-width: 120px;
    }
  `,
});

export const StreamingSection: React.FC<StreamingSectionProps> = ({ endpoint, onChange }) => {
  const styles = useStyles2(getStyles);
  const streaming = endpoint.streaming;
  const enabled = streaming?.enabled === true;
  const config = enabled ? streaming : null;

  const handleToggle = () => {
    onChange('streaming', enabled ? { enabled: false } : getDefaultConfig('sse'));
  };

  const handleStrategyChange = (strategyValue: string) => {
    onChange('streaming', getDefaultConfig(strategyValue as any));
  };

  const handleFieldChange = <K extends keyof Extract<StreamingConfig, { enabled: true }>>(field: K, value: any) => {
    if (!config) {
      return;
    }
    onChange('streaming', { ...config, [field]: value });
  };

  const extractionMode = config?.textEventType ? 'eventfield' : 'jsonpath';

  // ── Кастомные события (Event type + field → render) ────────────────────────
  const rules = config?.customEvents ?? [];

  const updateRules = (next: StreamEventHandler[]) => {
    if (!config) {
      return;
    }
    handleFieldChange('customEvents', next);
  };

  const addRule = () => updateRules([...rules, makeDefaultRule()]);

  /** Применяет AG-UI пресет (по индексу из AG_UI_PRESETS) к текущему стриминг-конфигу. */
  const applyAguiPreset = (presetIndex: number) => {
    if (!config) {
      return;
    }
    const preset = AG_UI_PRESETS[presetIndex];
    if (!preset) {
      return;
    }
    // SSE по умолчанию переключаем на извлечение текста по типу события (AG-UI).
    const patch: Record<string, any> = { ...preset.build() };
    if (config.parseStrategy === 'sse' && !config.textEventType) {
      const { textPath, ...rest } = config as any;
      onChange('streaming', {
        ...rest,
        textEventType: 'TEXT_MESSAGE_CONTENT',
        textDeltaField: 'delta',
        ...patch,
      });
      return;
    }
    onChange('streaming', { ...config, ...patch });
  };

  const removeRule = (index: number) => updateRules(rules.filter((_, i) => i !== index));

  const patchRule = (index: number, patch: Partial<StreamEventHandler>) => {
    updateRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const renderRuleCard = (rule: StreamEventHandler, index: number) => {
    const showValuePath = rule.render === 'chart' || rule.render === 'context';
    const optionalFields: Array<{ key: keyof StreamEventHandler; label: string; placeholder?: string }> = [
      { key: 'eventTypeField', label: 'Type field', placeholder: 'type' },
      { key: 'nameField', label: 'Name field', placeholder: 'name' },
    ];
    if (rule.render === 'code') {
      optionalFields.push({ key: 'language', label: 'Language', placeholder: 'json' });
    }
    if (rule.render === 'error') {
      optionalFields.push({ key: 'errorMessage', label: 'Fallback message', placeholder: 'Stream error' });
    }

    return (
      <div key={index} className={styles.ruleCard}>
        <div className={styles.ruleHeader}>
          <Label>Событие #{index + 1}</Label>
          <Button variant="destructive" size="sm" icon="trash-alt" onClick={() => removeRule(index)} tooltip="Удалить правило" />
        </div>
        <div className={styles.ruleRow}>
          <Field label="Event type" description="Значение поля типа (напр. CUSTOM, graph)">
            <Input value={rule.eventType} onChange={(e) => patchRule(index, { eventType: e.currentTarget.value })} />
          </Field>
          <Field label="Render" description="Как отображать">
            <Combobox
              options={RENDER_OPTIONS}
              value={rule.render}
              onChange={(opt) => patchRule(index, { render: (opt?.value ?? 'ignore') as StreamEventHandler['render'] })}
            />
          </Field>
        </div>
        <div className={styles.ruleRow}>
          <Field label="Name (опц.)" description="Доп. матчинг поля name (напр. graph vs dataset)">
            <Input
              value={rule.eventName ?? ''}
              placeholder="graph"
              onChange={(e) => patchRule(index, { eventName: e.currentTarget.value || undefined })}
            />
          </Field>
          {(showValuePath || rule.render === 'text' || rule.render === 'code') && (
            <Field label="Value path" description="Dot-path к данным внутри события">
              <Input
                value={rule.valuePath ?? 'value'}
                placeholder="value"
                onChange={(e) => patchRule(index, { valuePath: e.currentTarget.value || undefined })}
              />
            </Field>
          )}
          {rule.render === 'context' && (
            <Field label="Context key" description="Ключ в контексте сессии">
              <Input
                value={rule.contextKey ?? ''}
                placeholder="dataset"
                onChange={(e) => patchRule(index, { contextKey: e.currentTarget.value || undefined })}
              />
            </Field>
          )}
        </div>
        <div className={styles.ruleRow}>
          {optionalFields.map((f) => (
            <Field key={String(f.key)} label={f.label}>
              <Input
                value={(rule[f.key] as string) ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => patchRule(index, { [f.key]: e.currentTarget.value || undefined } as any)}
              />
            </Field>
          ))}
        </div>
        {(rule.render === 'chart' || rule.render === 'text') && (
          <div style={{ display: 'flex', gap: 16 }}>
            {rule.render === 'chart' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Label>Весь event как данные</Label>
                <Toggle
                  enabled={rule.wholeEvent === true}
                  onChange={() => patchRule(index, { wholeEvent: !rule.wholeEvent })}
                />
              </div>
            )}
            {rule.render === 'text' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Label>Отдельным абзацем</Label>
                  <Toggle
                    enabled={rule.paragraph !== false}
                    onChange={() => patchRule(index, { paragraph: rule.paragraph === false })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Label>В reasoning</Label>
                  <Toggle
                    enabled={rule.intoReasoning === true}
                    onChange={() => patchRule(index, { intoReasoning: !rule.intoReasoning })}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCustomEventsBlock = () => {
    if (!config) {
      return null;
    }
    return (
      <>
        <div className={styles.header}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            ⚙️ Кастомные события (Event type + field)
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Combobox
              width={18}
              placeholder="Пресеты AG-UI…"
              options={AG_UI_PRESETS.map((p, i) => ({ label: p.label, value: String(i) }))}
              onChange={(opt) => {
                if (opt?.value !== undefined && opt.value !== null) {
                  applyAguiPreset(Number(opt.value));
                }
              }}
            />
            <Button variant="secondary" size="sm" icon="plus" onClick={addRule}>
              Добавить событие
            </Button>
          </div>
        </div>
        {rules.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-weak)', opacity: 0.7 }}>
            Например: Event type = CUSTOM, Name = graph, Render = chart — чтобы рисовать графики из AG-UI событий.
            Или выберите пресет «AG-UI» справа.
          </div>
        )}
        {rules.map(renderRuleCard)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Label>Пустая строка между сообщениями (AG-UI)</Label>
          <Toggle
            enabled={config.paragraphBetweenMessages !== false}
            onChange={() => handleFieldChange('paragraphBetweenMessages', !(config.paragraphBetweenMessages !== false))}
          />
        </div>
      </>
    );
  };

  const handleExtractionModeChange = (mode: string) => {
    if (!config || config.parseStrategy !== 'sse') {
      return;
    }
    if (mode === 'jsonpath') {
      const { textEventType, textDeltaField, ...rest } = config;
      onChange('streaming', { ...rest, textPath: config.textPath ?? 'choices[0].delta.content' });
    } else {
      const { textPath, ...rest } = config;
      onChange('streaming', {
        ...rest,
        textEventType: config.textEventType ?? 'TEXT_MESSAGE_CONTENT',
        textDeltaField: config.textDeltaField ?? 'delta',
      });
    }
  };

  const renderSseFields = () => {
    if (!config) {
      return null;
    }
    return (
      <>
        <Field label="Extraction mode">
          <Combobox
            options={EXTRACTION_MODE_OPTIONS}
            value={extractionMode}
            onChange={(opt) => handleExtractionModeChange(opt?.value)}
          />
        </Field>
        {extractionMode === 'jsonpath' ? (
          <Field label="JSON path (dot notation)" description="e.g., choices[0].delta.content">
            <Input
              value={config.textPath ?? DEFAULT_STREAMING.textPath}
              onChange={(e) => handleFieldChange('textPath', e.currentTarget.value)}
            />
          </Field>
        ) : (
          <>
            <Field label="Event type" description="Type field value to filter (e.g., TEXT_MESSAGE_CONTENT)">
              <Input
                value={config.textEventType ?? 'TEXT_MESSAGE_CONTENT'}
                onChange={(e) => handleFieldChange('textEventType', e.currentTarget.value)}
              />
            </Field>
            <Field label="Delta field" description="Field containing the text chunk (e.g., delta)">
              <Input
                value={config.textDeltaField ?? 'delta'}
                onChange={(e) => handleFieldChange('textDeltaField', e.currentTarget.value)}
              />
            </Field>
          </>
        )}
      </>
    );
  };

  const renderJsonlFields = () => {
    if (!config) {
      return null;
    }
    return (
      <Field label="JSON path (dot notation)" description="e.g., choices[0].delta.content">
        <Input
          value={config.textPath ?? DEFAULT_STREAMING.textPath}
          onChange={(e) => handleFieldChange('textPath', e.currentTarget.value)}
        />
      </Field>
    );
  };

  const renderStrategyFields = () => {
    if (!config) {
      return null;
    }
    switch (config.parseStrategy) {
      case 'sse':
        return renderSseFields();
      case 'jsonl':
        return renderJsonlFields();
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>📡 Streaming</div>
        <Toggle enabled={enabled} onChange={handleToggle} />
      </div>
      {enabled && config && (
        <div className={styles.fields}>
          <Field label="Parse strategy">
            <Combobox
              options={PARSE_STRATEGY_OPTIONS}
              value={config.parseStrategy}
              onChange={(opt) => handleStrategyChange(opt?.value)}
            />
          </Field>
          {renderStrategyFields()}
          {renderCustomEventsBlock()}
        </div>
      )}
    </div>
  );
};
