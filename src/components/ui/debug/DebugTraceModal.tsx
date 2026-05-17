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
    keyValue: css`
      margin: 4px 0;
    `,
  };

  // Функция для удобного отображения значения (независимо от типа)
  const renderValue = (value: any): React.ReactNode => {
    if (value === undefined) {
      return '<undefined>';
    }
    if (value === null) {
      return '<null>';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return <pre className={styles.pre}>{JSON.stringify(value, null, 2)}</pre>;
  };

  // Универсальный рендер шага: выводим все поля, кроме type и timestamp
  const renderStepDetails = (step: TraceStep) => {
    // Специальная обработка для нескольких ключевых типов (для удобства)
    switch (step.type) {
      case 'request':
        return (
          <>
            <div className={styles.keyValue}>
              <strong>URL:</strong> {step.method} {step.url}
            </div>
            <div className={styles.keyValue}>
              <strong>Body:</strong>
              <pre className={styles.pre}>{JSON.stringify(step.requestBody, null, 2)}</pre>
            </div>
          </>
        );
      case 'response':
        return (
          <div className={styles.keyValue}>
            <strong>Response body:</strong>
            <pre className={styles.pre}>{JSON.stringify(step.responseBody, null, 2)}</pre>
          </div>
        );
      case 'text_chunk':
        return (
          <div className={styles.keyValue}>
            <strong>Text chunk:</strong>
            <div className={styles.pre}>{step.chunk}</div>
          </div>
        );
      case 'reasoning_chunk':
        return (
          <div className={styles.keyValue}>
            <strong>Reasoning chunk:</strong>
            <div className={styles.pre}>{step.chunk}</div>
          </div>
        );
      case 'reasoning_complete':
        return (
          <div className={styles.keyValue}>
            <strong>Reasoning complete:</strong>
            <pre className={styles.pre}>{step.fullReasoning || step.reasoningText}</pre>
          </div>
        );
      case 'error':
        return (
          <div className={styles.keyValue}>
            <strong>Error:</strong> {step.error}
          </div>
        );
      // Для всех остальных типов – выводим все поля (кроме type и timestamp)
      default:
        const { type, timestamp, ...rest } = step;
        if (Object.keys(rest).length === 0) {
          return <div className={styles.smallText}>No additional data</div>;
        }
        return (
          <div>
            {Object.entries(rest).map(([key, val]) => (
              <div key={key} className={styles.keyValue}>
                <strong>{key}:</strong> {renderValue(val)}
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <Modal title="Debug Trace" isOpen={isOpen} onDismiss={onDismiss} className={styles.modalStyle}>
      <div className={styles.keyValue}>
        <strong>User input:</strong> {trace.userInput}
      </div>
      {trace.finalReply && (
        <div className={styles.keyValue}>
          <strong>Final reply:</strong> {trace.finalReply}
        </div>
      )}
      {trace.error && (
        <div style={{ color: theme.colors.error.main }} className={styles.keyValue}>
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
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          Close
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
