import React from 'react';
import { Modal, Button, useTheme2 } from '@grafana/ui';
import { DebugTrace, TraceStep } from 'types';
import { css } from '@emotion/css';

interface DebugTraceModalProps {
  isOpen: boolean;
  trace: DebugTrace | null;
  onDismiss: () => void;
}

export const DebugTraceModal: React.FC<DebugTraceModalProps> = ({ isOpen, trace, onDismiss }) => {
  const theme = useTheme2();

  if (!trace) {
    return null;
  }

  const styles = {
    modalStyle: css`
      z-index: 100000 !important;
    `,
    container: css`
      max-height: 70vh;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
    `,
    step: css`
      margin-bottom: 16px;
      padding: 8px;
      border-left: 3px solid ${theme.colors.primary.main};
      background: ${theme.colors.background.secondary};
    `,
    pre: css`
      white-space: pre-wrap;
      word-break: break-word;
      margin: 8px 0;
      background: ${theme.colors.background.primary};
      padding: 4px;
    `,
    smallText: css`
      font-size: 11px;
      color: ${theme.colors.text.secondary};
    `,
  };

  const renderStepDetails = (step: TraceStep) => {
    switch (step.type) {
      case 'request':
        return (
          <>
            <div>
              <strong>URL:</strong> {step.method} {step.url}
            </div>
            <div>
              <strong>Body:</strong>
              <pre className={styles.pre}>{JSON.stringify(step.requestBody, null, 2)}</pre>
            </div>
          </>
        );
      case 'response':
        return (
          <div>
            <strong>Response:</strong>
            <pre className={styles.pre}>{JSON.stringify(step.responseBody, null, 2)}</pre>
          </div>
        );
      case 'polling':
        return (
          <div>
            <strong>Poll attempt #{step.pollingAttempt}:</strong>
            <pre className={styles.pre}>{JSON.stringify(step.responseBody, null, 2)}</pre>
          </div>
        );
      case 'context_update':
        return (
          <div>
            <strong>Context updated:</strong>
            <pre className={styles.pre}>{JSON.stringify(step.contextChanges, null, 2)}</pre>
          </div>
        );
      case 'raw_sse_line':
        return (
          <div>
            <strong>Raw SSE line:</strong>
            <pre className={styles.pre}>{step.rawLine || step.line}</pre>
          </div>
        );
      case 'sse_event':
      case 'sse_separate_event':
        return (
          <div>
            <strong>SSE Event ({step.eventType || 'unknown'}):</strong>
            <pre className={styles.pre}>{JSON.stringify(step.eventData, null, 2)}</pre>
          </div>
        );
      case 'text_chunk':
        return (
          <div>
            <strong>Text chunk:</strong>
            <div className={styles.pre}>{step.chunk}</div>
          </div>
        );
      case 'reasoning_chunk':
        return (
          <div>
            <strong>Reasoning chunk:</strong>
            <div className={styles.pre}>{step.chunk}</div>
          </div>
        );
      case 'reasoning_complete':
        return (
          <div>
            <strong>Reasoning complete:</strong>
            <pre className={styles.pre}>{step.fullReasoning || step.reasoningText}</pre>
          </div>
        );
      case 'reasoning_extracted_from_tags':
        return (
          <div>
            <strong>Reasoning extracted from tags:</strong>
            <pre className={styles.pre}>{step.reasoningText}</pre>
          </div>
        );
      case 'text_cleaned_from_tags':
        return (
          <div>
            <strong>Text cleaned from tags:</strong>
            <div className={styles.pre}>Original: {step.originalText}</div>
            <div className={styles.pre}>Cleaned: {step.cleanedText}</div>
          </div>
        );
      case 'thinking_start':
        return (
          <div>
            <strong>Thinking started</strong>
            {step.title && `: ${step.title}`}
          </div>
        );
      case 'thinking_end':
        return (
          <div>
            <strong>Thinking ended</strong>
          </div>
        );
      case 'history_sync':
        return (
          <div>
            <strong>History sync:</strong> {step.messagesCount} messages
          </div>
        );
      case 'sse_stream_end':
      case 'sse_separate_end':
        return (
          <div>
            <strong>SSE stream ended</strong> {step.reason && `(${step.reason})`}
          </div>
        );
      case 'sse_parse_error':
        return (
          <div>
            <strong>SSE parse error:</strong>
            <div className={styles.smallText}>Line: {step.rawLine || step.line}</div>
            <div className={styles.smallText}>Error: {step.error}</div>
          </div>
        );
      case 'error':
        return (
          <div>
            <strong>Error:</strong> {step.error}
          </div>
        );
      default:
        // fallback для неизвестных типов
        return (
          <div>
            <strong>Unknown step type:</strong>
            <pre className={styles.pre}>{JSON.stringify(step, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <Modal title="Debug Trace" isOpen={isOpen} onDismiss={onDismiss} className={styles.modalStyle}>
      <div className={styles.container}>
        <div>
          <strong>User input:</strong> {trace.userInput}
        </div>
        {trace.finalReply && (
          <div>
            <strong>Final reply:</strong> {trace.finalReply}
          </div>
        )}
        {trace.error && (
          <div style={{ color: theme.colors.error.main }}>
            <strong>Error:</strong> {trace.error.message}
            {trace.error.raw && <pre className={styles.pre}>{trace.error.raw}</pre>}
          </div>
        )}
        <h4>Steps ({trace.steps.length})</h4>
        {trace.steps.map((step, idx) => (
          <div key={idx} className={styles.step}>
            <div>
              <strong>{step.type.toUpperCase()}</strong> @ {new Date(step.timestamp).toLocaleTimeString()}
            </div>
            {renderStepDetails(step)}
          </div>
        ))}
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          Close
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
