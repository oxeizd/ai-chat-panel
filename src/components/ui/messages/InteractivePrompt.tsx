import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Combobox, Input, useTheme2 } from '@grafana/ui';
import { InteractiveField, InteractiveOption } from 'types';
import { SubmitButton } from 'components/ui/hooks/useSubmitBehavior';

const COMPOSER_MIN_HEIGHT = 72;
const COMPOSER_ACTION_SIZE = 32;
const COMPOSER_BOTTOM_OFFSET = 8;
const COMPOSER_RIGHT_OFFSET = 8;
const COMPOSER_ACTION_SAFE_AREA = COMPOSER_ACTION_SIZE + COMPOSER_RIGHT_OFFSET + 8;
const COMPACT_INPUT_STYLE: React.CSSProperties = { height: 28 };

interface InteractiveOptionsColumnProps {
  options: InteractiveOption[];
  onSubmit: (text: string) => void;
  /** Ваш существующий CSS-класс стандартной кнопки отправки чата. */
  sendButtonClassName?: string;
}

/**
 * Список быстрых вариантов вместо стандартного input. Обычные варианты
 * отправляются кликом. Для Other последняя строка становится полноценным
 * input на всю доступную ширину ДО кнопки, а кнопка расположена справа.
 */
export const InteractiveOptionsColumn: React.FC<InteractiveOptionsColumnProps> = ({
  options,
  onSubmit,
  sendButtonClassName,
}) => {
  const theme = useTheme2();
  const [customOptionIdx, setCustomOptionIdx] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Focus применяется только к активному ВНУТРЕННЕМУ input. Внешний
  // composer box не получает синюю рамку и остаётся визуально спокойным.
  const interactiveInputClass = css`
    & input:focus {
      outline: none !important;
      border-color: ${theme.colors.border.medium} !important;
      box-shadow: inset 0 0 0 1px ${theme.colors.primary.main} !important;
    }
  `;

  const handleOptionClick = (option: InteractiveOption, idx: number) => {
    if (option.allowCustom) {
      setCustomOptionIdx(idx);
      setCustomValue('');
      return;
    }
    onSubmit(option.value ?? option.label);
  };

  const handleCustomSubmit = () => {
    if (!customValue.trim()) {
      return;
    }
    onSubmit(customValue.trim());
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        minHeight: COMPOSER_MIN_HEIGHT,
        padding: theme.spacing(0.5),
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.medium}`,
        borderRadius: theme.shape.radius.default,
      }}
    >
      {options.map((opt, idx) => {
        const isCustomRow = customOptionIdx === idx;

        if (isCustomRow) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing(0.75),
                width: '100%',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  sizes="sm"
                  className={interactiveInputClass}
                  style={COMPACT_INPUT_STYLE}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.currentTarget.value)}
                  placeholder="Свой вариант..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomSubmit();
                    }
                  }}
                />
              </div>
              <SubmitButton
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className={sendButtonClassName}
                style={{ position: 'static', flexShrink: 0 }}
              />
            </div>
          );
        }

        return (
          <div
            key={idx}
            onClick={() => handleOptionClick(opt, idx)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
              fontSize: '0.85rem',
              lineHeight: 1.3,
              cursor: 'pointer',
              borderRadius: theme.shape.radius.default,
              transition: 'background 0.15s',
              background: hoveredIdx === idx ? theme.colors.action.hover : 'transparent',
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
};

interface InteractiveFieldsFormProps {
  fields: InteractiveField[];
  onSubmit: (text: string, extraContext?: Record<string, any>) => void;
  /** Ваш существующий CSS-класс стандартной кнопки отправки чата. */
  sendButtonClassName?: string;
}

/**
 * Компактная форма вместо input. Все поля заканчиваются до кнопки отправки,
 * а последний input находится с ней на одной горизонтали.
 */
export const InteractiveFieldsForm: React.FC<InteractiveFieldsFormProps> = ({
  fields,
  onSubmit,
  sendButtonClassName,
}) => {
  const theme = useTheme2();
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  const interactiveInputClass = css`
    & input:focus {
      outline: none !important;
      border-color: ${theme.colors.border.medium} !important;
      box-shadow: inset 0 0 0 1px ${theme.colors.primary.main}33 !important;
    }
  `;

  const updateField = (name: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const isValid = !fields.some((f) => f.required && !String(fieldValues[f.name] ?? '').trim());

  const handleSubmit = () => {
    if (!isValid) {
      return;
    }
    const text = fields.map((f) => `${f.label || f.name}: ${fieldValues[f.name] ?? ''}`).join(', ');
    onSubmit(text, { formData: fieldValues });
  };

  const renderField = (field: InteractiveField) => {
    const value = fieldValues[field.name] ?? '';

    if (field.type === 'select') {
      return (
        <Combobox
          value={value ? { label: value, value } : null}
          options={(field.options || []).map((o) => ({ label: o, value: o }))}
          onChange={(opt) => updateField(field.name, opt?.value ?? '')}
          placeholder={field.placeholder}
        />
      );
    }

    return (
      <Input
        sizes="sm"
        className={interactiveInputClass}
        style={COMPACT_INPUT_STYLE}
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => updateField(field.name, e.currentTarget.value)}
        placeholder={field.placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
      />
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: COMPOSER_MIN_HEIGHT,
        padding: `${theme.spacing(0.5)} ${COMPOSER_ACTION_SAFE_AREA}px ${theme.spacing(0.5)} ${theme.spacing(0.5)}`,
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.medium}`,
        borderRadius: theme.shape.radius.default,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(0.4) }}>
        {fields.map((field) => (
          <div key={field.name}>
            {field.label && (
              <div style={{ fontSize: 11, lineHeight: 1.1, marginBottom: 2, opacity: 0.75 }}>{field.label}</div>
            )}
            {renderField(field)}
          </div>
        ))}
      </div>

      <SubmitButton
        onClick={handleSubmit}
        disabled={!isValid}
        className={sendButtonClassName}
        style={{
          position: 'absolute',
          right: COMPOSER_RIGHT_OFFSET,
          bottom: COMPOSER_BOTTOM_OFFSET,
          zIndex: 1,
        }}
      />
    </div>
  );
};
