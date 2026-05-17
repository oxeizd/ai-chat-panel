import React, { useMemo } from 'react';
import { Icon, useTheme2 } from '@grafana/ui';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  inline?: boolean;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline, language: propLanguage }) => {
  const theme = useTheme2();
  const { copied, copy } = useCopyToClipboard();

  const language = propLanguage || (className?.replace('language-', '') ?? '');

  const codeText = useMemo(() => {
    if (typeof children === 'string') {
      return children;
    }
    if (React.isValidElement(children) && children.props?.children) {
      return children.props.children;
    }
    return '';
  }, [children]);

  const handleCopy = () => copy(codeText);

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  return (
    <div>
      {/* Шапка: язык слева, кнопка копирования справа */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          color: '#94a3b8',
          padding: '0 0.2rem 0.2rem 0.2rem',
        }}
      >
        {language && <span>{language}</span>}
        <button
          onClick={handleCopy}
          style={{
            marginLeft: language ? 'auto' : 'auto',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            fontSize: '0.7rem',
            color: '#94a3b8',
            padding: '0.1rem 0.3rem',
            borderRadius: '6px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Icon name={copied ? 'check' : 'copy'} style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
      {/* Блок кода – отменяем глобальные бордеры и фон */}
      <pre
        className={className}
        style={{
          margin: 0,
          padding: '0.5rem',
          background: 'rgb(17 18 23 / 15%)',
          overflowX: 'auto',
          whiteSpace: 'pre',
          wordBreak: 'normal',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          borderRadius: '4px',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
        }}
      >
        <code
          className={className}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: theme.colors.text.primary,
          }}
        >
          {children}
        </code>
      </pre>
    </div>
  );
};
