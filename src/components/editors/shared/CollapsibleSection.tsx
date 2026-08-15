import React from 'react';
import { Icon, useTheme2 } from '@grafana/ui';
import { useAutoCollapse } from './useAutoCollapse';

interface CollapsibleSectionProps {
  title: string;
  enabled: boolean;
  /**
   * Если true — секция полностью скрывается, когда enabled === false
   * (используется, когда чекбокс включения находится СНАРУЖИ этого
   * компонента — например, "Enable History" в WorkflowSection).
   * Если false (по умолчанию) — секция остаётся видимой и развёрнутой
   * при enabled === false, потому что сам чекбокс включения лежит
   * ВНУТРИ children (например, опаковые PollingSection/StreamingSection/
   * ReasoningSection — иначе до чекбокса просто не добраться).
   */
  hideWhenDisabled?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  enabled,
  hideWhenDisabled = false,
  children,
}) => {
  const theme = useTheme2();
  const [collapsed, toggle] = useAutoCollapse(enabled);

  if (!enabled && hideWhenDisabled) {
    return null;
  }

  const effectiveCollapsed = enabled ? collapsed : false;

  return (
    <div
      style={{
        marginBottom: enabled ? 8 : 4,
        border: `1px solid ${theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.default,
      }}
    >
      <div
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: enabled ? '6px 10px' : '4px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={effectiveCollapsed ? 'angle-right' : 'angle-down'} size="sm" />
          <strong style={{ fontSize: enabled ? 13 : 12.5, opacity: enabled ? 1 : 0.75 }}>{title}</strong>
        </div>
        <span
          style={{
            fontSize: 10.5,
            padding: '1px 5px',
            borderRadius: 4,
            background: enabled ? theme.colors.success.main : theme.colors.background.secondary,
            color: enabled ? 'white' : theme.colors.text.secondary,
          }}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      {!effectiveCollapsed && <div style={{ padding: '0 10px 8px 10px' }}>{children}</div>}
    </div>
  );
};
