import { css } from '@emotion/css';
import React, { useState, forwardRef } from 'react';
import { Button, useTheme2, Collapse } from '@grafana/ui';
import { EndpointConfig } from 'types';
import {
  DEFAULT_POLLING,
  DEFAULT_STREAMING,
  DEFAULT_REASONING,
  DEFAULT_HISTORY,
} from 'components/agent/config/defaults';
import { CollapsibleSection } from 'components/editors/shared/CollapsibleSection';
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
    let updated: EndpointConfig = { ...endpoint, [field]: val };

    if (field === 'polling') {
      const wasEnabled = endpoint.polling?.enabled === true;
      if (val?.enabled === true) {
        updated.streaming = { enabled: false };
        if (!wasEnabled) {
          updated.polling = { ...DEFAULT_POLLING, ...val };
        }
      }
    }

    if (field === 'streaming') {
      const wasEnabled = endpoint.streaming?.enabled === true;
      if (val?.enabled === true) {
        updated.polling = { enabled: false };
        if (!wasEnabled) {
          updated.streaming = { parseStrategy: 'sse', ...DEFAULT_STREAMING, ...val };
        }
      }
    }

    if (field === 'reasoning') {
      const wasEnabled = endpoint.reasoning?.enabled === true;
      if (val?.enabled === true && !wasEnabled) {
        updated.reasoning = {
          type: 'embedded',
          mode: 'api_field',
          apiField: DEFAULT_REASONING.apiField,
          textPath: DEFAULT_REASONING.textPath,
          startMarker: DEFAULT_REASONING.startMarker,
          endMarker: DEFAULT_REASONING.endMarker,
          ...val,
        };
      }
    }

    if (field === 'historyConfig') {
      const wasEnabled = endpoint.historyConfig?.enabled === true;
      if (val?.enabled === true && !wasEnabled) {
        updated.historyConfig = {
          mode: 'local',
          historyField: DEFAULT_HISTORY.historyField,
          ...val,
        };
      }
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

          {/* Polling: свёрнуто по умолчанию, если было уже включено при
              открытии; сразу развёрнуто, если включили только сейчас. */}
          <CollapsibleSection title="Polling" enabled={endpoint.polling?.enabled === true}>
            <PollingSection endpoint={endpoint} onChange={handleEndpointChange} />
          </CollapsibleSection>

          {/* Streaming */}
          <CollapsibleSection title="Streaming" enabled={endpoint.streaming?.enabled === true}>
            <StreamingSection endpoint={endpoint} onChange={handleEndpointChange} />
          </CollapsibleSection>

          {/* Reasoning / Thinking */}
          <CollapsibleSection title="Reasoning" enabled={endpoint.reasoning?.enabled === true}>
            <ReasoningSection endpoint={endpoint} onChange={handleEndpointChange} />
          </CollapsibleSection>

          {/* Conversation History (per-endpoint) */}
          <CollapsibleSection title="Conversation History" enabled={endpoint.historyConfig?.enabled === true}>
            <HistorySection endpoint={endpoint} onChange={handleEndpointChange} />
          </CollapsibleSection>
        </div>
      </Collapse>
    </div>
  );
});
