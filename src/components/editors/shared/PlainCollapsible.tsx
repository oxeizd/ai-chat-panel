import React, { useState } from 'react';
import { Icon, useTheme2 } from '@grafana/ui';

interface PlainCollapsibleProps {
  title: string;
  description?: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

/**
 * Лёгкая сворачиваемая обёртка для организационных подгрупп настроек внутри
 * уже включённой секции (например, "Thread list item fields" и "Thread
 * message fields" внутри History settings). В отличие от CollapsibleSection
 * здесь нет понятия enabled/disabled — это просто способ не показывать все
 * поля сразу, когда их много.
 */
export const PlainCollapsible: React.FC<PlainCollapsibleProps> = ({
  title,
  description,
  defaultCollapsed = true,
  children,
}) => {
  const theme = useTheme2();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.default,
      }}
    >
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Icon name={collapsed ? 'angle-right' : 'angle-down'} />
        <strong style={{ fontSize: 13 }}>{title}</strong>
      </div>
      {!collapsed && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          {description && <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{description}</div>}
          {children}
        </div>
      )}
    </div>
  );
};
