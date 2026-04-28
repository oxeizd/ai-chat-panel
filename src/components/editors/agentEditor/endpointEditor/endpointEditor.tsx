import React, { useState, forwardRef } from 'react';
import { Button, useTheme2, Collapse } from '@grafana/ui';
import { css } from '@emotion/css';
import { EndpointConfig } from 'types';
import { ResponseHandlingSection } from './sections/ResponseSection';
import { PollingSection } from './sections/PollingSection';
import { StreamingSection } from './sections/StreamingSection';
import { HistorySection } from './sections/HistorySection';
import { BasicEndpointFields } from './sections/BasicEndpointFields';
import { BodySection, HeadersSection } from './sections/BasicSections';

const getEndpointEditorStyles = (theme: ReturnType<typeof useTheme2>) => ({
  container: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    margin-bottom: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  `,
  content: css`
    padding: ${theme.spacing(1)};
    border-top: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
  `,
});

export interface EndpointEditorHandle {
  getCurrentValue: () => { body: Record<string, any>; headers: Record<string, string> };
}

interface EndpointEditorProps {
  endpoint: EndpointConfig;
  index: number;
  onChange: (index: number, updated: EndpointConfig) => void;
  onRemove: (index: number) => void;
}

export const EndpointEditor = forwardRef<EndpointEditorHandle, EndpointEditorProps>(function EndpointEditor(
  { endpoint, index, onChange, onRemove },
  ref
) {
  const theme = useTheme2();
  const styles = getEndpointEditorStyles(theme);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (field: keyof EndpointConfig, val: any) => {
    onChange(index, { ...endpoint, [field]: val });
  };

  const label = (
    <div className={styles.header}>
      <strong>
        Endpoint #{index + 1} {endpoint.operation ? `– ${endpoint.operation}` : ''}
      </strong>
      <Button
        variant="destructive"
        size="sm"
        icon="trash-alt"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        aria-label="Delete endpoint"
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <Collapse label={label} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <div className={styles.content}>
          {/* Basic */}
          <BasicEndpointFields endpoint={endpoint} onChange={handleChange} />

          {/* Headers */}
          <HeadersSection endpoint={endpoint} onChange={handleChange} />

          {/* Request body */}
          <BodySection endpoint={endpoint} onChange={handleChange} />

          {/* Response handling */}
          <ResponseHandlingSection endpoint={endpoint} onChange={handleChange} />

          {/* Polling */}
          <PollingSection endpoint={endpoint} onChange={handleChange} />

          {/* Streaming */}
          <StreamingSection endpoint={endpoint} onChange={handleChange} />

          {/* Conversation History */}
          <HistorySection endpoint={endpoint} onChange={handleChange} />
        </div>
      </Collapse>
    </div>
  );
});
