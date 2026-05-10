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

export const REASONING_DEFAULTS = {
  mode: 'both' as const,
  apiField: 'choices[0].delta.reasoning_content',
  textPath: 'choices[0].delta.content',
  startMarker: '<thinking>',
  endMarker: '</thinking>',
} as const;