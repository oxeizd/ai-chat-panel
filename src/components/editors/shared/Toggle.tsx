import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const getToggleStyles = (theme: any) => {
  const isDark = theme.colors.mode === 'dark';
  const activeColor = isDark ? '#00c28a' : '#039866';
  const disabledColor = isDark ? '#4a4a5a' : '#e8e8ef';
  const disabledBorder = isDark ? '#5a5a6a' : '#c0c0c0';

  return {
    container: css`
      width: 32px;
      height: 20px;
      border-radius: 10px;
      background: ${activeColor};
      border: 1px solid ${activeColor};
      position: relative;
      cursor: pointer;
      transition:
        background 0.2s,
        border-color 0.2s;
      flex-shrink: 0;
    `,
    containerDisabled: css`
      width: 32px;
      height: 20px;
      border-radius: 10px;
      background: ${disabledColor};
      border: 1px solid ${disabledBorder};
      position: relative;
      cursor: pointer;
      transition:
        background 0.2s,
        border-color 0.2s;
      flex-shrink: 0;
    `,
    knob: css`
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      position: absolute;
      top: 1px;
      transition: left 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    `,
    knobDisabled: css`
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #999;
      position: absolute;
      top: 1px;
      transition: left 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    `,
  };
};

export const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, style, className }) => {
  const styles = useStyles2((t) => getToggleStyles(t));

  return (
    <div
      className={[enabled ? styles.container : styles.containerDisabled, className].filter(Boolean).join(' ')}
      style={style}
      onClick={onChange}
    >
      <div className={enabled ? styles.knob : styles.knobDisabled} style={{ left: enabled ? '13px' : '1px' }} />
    </div>
  );
};
