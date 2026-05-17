import { css } from '@emotion/css';
import React, { useState, forwardRef } from 'react';
import { Button, useTheme2, Collapse } from '@grafana/ui';
import { EndpointConfig } from 'types';
import { PollingSection } from './sections/PollingSection';
import { HistorySection } from './sections/HistorySection';
import { ReasoningSection } from './sections/ReasoningSection';
import { StreamingSection } from './sections/StreamingSection';
import { ResponseHandlingSection } from './sections/ResponseSection';
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

  const handleEndpointChange = (field: keyof EndpointConfig, val: any) => {
    let updated = { ...endpoint, [field]: val };

    // Включение polling выключает streaming
    if (field === 'polling' && val?.enabled === true) {
      updated.streaming = { enabled: false };
    }
    // Включение streaming выключает polling
    if (field === 'streaming' && val?.enabled === true) {
      updated.polling = { enabled: false };
    }

    onChange(index, updated);
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
          <BasicEndpointFields endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Headers */}
          <HeadersSection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Request body */}
          <BodySection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Response handling */}
          <ResponseHandlingSection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Polling */}
          <PollingSection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Streaming */}
          <StreamingSection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Reasoning / Thinking */}
          <ReasoningSection endpoint={endpoint} onChange={handleEndpointChange} />

          {/* Conversation History */}
          <HistorySection endpoint={endpoint} onChange={handleEndpointChange} />
        </div>
      </Collapse>
    </div>
  );
});
