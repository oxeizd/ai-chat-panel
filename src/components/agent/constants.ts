export const STREAMING_DEFAULTS = {
  textPath: 'choices.0.delta.content',
  delimiter: '\n\n',
  dataPrefix: 'data: ',
} as const;

export const POLLING_DEFAULTS = {
  intervalMs: 1000,
  maxAttempts: 10,
  statusField: 'status',
  successValue: 'completed',
  resultField: 'result',
} as const;
