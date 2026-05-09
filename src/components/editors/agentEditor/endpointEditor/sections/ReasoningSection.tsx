import React from 'react';
import { Switch, Field, Input, Combobox, useTheme2 } from '@grafana/ui';
import { EndpointConfig, ReasoningConfig } from 'types';

interface ReasoningSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

/**
 * Опции для выбора режима извлечения мыслей.
 */
const MODE_OPTIONS = [
  { label: 'Both (API field + tags)', value: 'both' },
  { label: 'API field only', value: 'api_field' },
  { label: 'Thinking tags only', value: 'thinking_tags' },
];

/**
 * Секция настройки Reasoning / Thinking в редакторе эндпоинта.
 *
 * Позволяет:
 * - Включить/отключить извлечение мыслей ассистента.
 * - Выбрать режим (через API, через теги <thinking>, оба).
 * - Настроить пути и маркеры.
 */
export const ReasoningSection: React.FC<ReasoningSectionProps> = ({ endpoint, onChange }) => {
  const theme = useTheme2();

  /**
   * Проверяет, включено ли сейчас reasoning.
   */
  const isEnabled = (): boolean => {
    if (!endpoint.reasoning) {
      return false;
    }
    if (typeof endpoint.reasoning === 'boolean') {
      return endpoint.reasoning;
    }
    return endpoint.reasoning.enabled === true;
  };

  /**
   * Возвращает объект конфигурации, если он задан.
   */
  const getConfig = (): ReasoningConfig | null => {
    if (!endpoint.reasoning || typeof endpoint.reasoning === 'boolean') {
      return null;
    }
    return endpoint.reasoning;
  };

  /**
   * Обработчик включения/выключения.
   *
   * При включении подставляет дефолтные значения,
   * если до этого был просто boolean или undefined.
   */
  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      if (!endpoint.reasoning || typeof endpoint.reasoning === 'boolean') {
        onChange('reasoning', {
          enabled: true,
          mode: 'both',
          apiField: 'choices[0].delta.reasoning_content',
          textPath: 'choices[0].delta.content',
          startMarker: '<thinking>',
          endMarker: '</thinking>',
        });
      } else {
        onChange('reasoning', { ...endpoint.reasoning, enabled: true });
      }
    } else {
      // Полностью отключаем — ответ будет показываться сразу
      onChange('reasoning', false);
    }
  };

  /**
   * Обработчик изменения отдельного поля внутри ReasoningConfig.
   */
  const handleFieldChange = (field: keyof ReasoningConfig, val: any) => {
    let current = endpoint.reasoning;
    if (!current || typeof current === 'boolean') {
      // Если по какой-то причине конфига ещё нет, создаём с дефолтами
      current = {
        enabled: true,
        mode: 'both',
        apiField: 'choices[0].delta.reasoning_content',
        textPath: 'choices[0].delta.content',
        startMarker: '<thinking>',
        endMarker: '</thinking>',
      };
    }
    onChange('reasoning', { ...current, [field]: val });
  };

  const config = getConfig();
  const showApiField = config?.mode === 'api_field' || config?.mode === 'both';
  const showTagsField = config?.mode === 'thinking_tags' || config?.mode === 'both';

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Заголовок с переключателем */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text.secondary,
          }}
        >
          🤔 Reasoning / Thinking
        </div>
        <Switch value={isEnabled()} onChange={(e) => handleToggle(e.currentTarget.checked)} />
      </div>

      {/* Дополнительные поля, если включено */}
      {isEnabled() && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          {/* Выбор режима */}
          <Field label="Extraction mode">
            <Combobox
              options={MODE_OPTIONS}
              value={config?.mode ?? 'both'}
              onChange={(opt) => handleFieldChange('mode', opt?.value)}
            />
          </Field>

          {/* Поля, видимые только для API‑режима */}
          {showApiField && (
            <Field label="API field path for reasoning">
              <Input
                value={config?.apiField ?? 'choices[0].delta.reasoning_content'}
                onChange={(e) => handleFieldChange('apiField', e.currentTarget.value)}
                placeholder="choices[0].delta.reasoning_content"
              />
            </Field>
          )}

          {/* Поля, видимые только для режима тегов */}
          {showTagsField && (
            <>
              <Field label="Text path for tag search">
                <Input
                  value={config?.textPath ?? 'choices[0].delta.content'}
                  onChange={(e) => handleFieldChange('textPath', e.currentTarget.value)}
                  placeholder="choices[0].delta.content"
                />
              </Field>
              <Field label="Start marker">
                <Input
                  value={config?.startMarker ?? '<thinking>'}
                  onChange={(e) => handleFieldChange('startMarker', e.currentTarget.value)}
                  placeholder="<thinking>"
                />
              </Field>
              <Field label="End marker">
                <Input
                  value={config?.endMarker ?? '</thinking>'}
                  onChange={(e) => handleFieldChange('endMarker', e.currentTarget.value)}
                  placeholder="</thinking>"
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
};
