import React from 'react';
import { Modal, Button, useTheme2 } from '@grafana/ui';
import { DebugTrace } from 'types';
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

  const modalStyle = css`
    z-index: 100000 !important;
  `;

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
    `,
  };

  return (
    <Modal title="Debug Trace" isOpen={isOpen} onDismiss={onDismiss} className={modalStyle}>
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
          </div>
        )}
        <h4>Steps ({trace.steps.length})</h4>
        {trace.steps.map((step, idx) => (
          <div key={idx} className={styles.step}>
            <div>
              <strong>{step.type.toUpperCase()}</strong> @ {new Date(step.timestamp).toLocaleTimeString()}
            </div>
            {step.type === 'request' && (
              <>
                <div>
                  URL: {step.method} {step.url}
                </div>
                <div>
                  Body: <pre className={styles.pre}>{JSON.stringify(step.requestBody, null, 2)}</pre>
                </div>
              </>
            )}
            {step.type === 'response' && (
              <div>
                Response: <pre className={styles.pre}>{JSON.stringify(step.responseBody, null, 2)}</pre>
              </div>
            )}
            {step.type === 'polling' && (
              <div>
                Poll attempt #{step.pollingAttempt}: {JSON.stringify(step.responseBody)}
              </div>
            )}
            {step.type === 'context_update' && (
              <div>
                Context updated: <pre className={styles.pre}>{JSON.stringify(step.contextChanges, null, 2)}</pre>
              </div>
            )}
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
