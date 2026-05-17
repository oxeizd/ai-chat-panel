export const DEFAULT_POLLING = {
  intervalMs: 1000,
  maxAttempts: 10,
  statusField: 'status',
  successValue: 'completed',
  resultField: 'result',
} as const;

export const DEFAULT_STREAMING = {
  textPath: 'choices.0.delta.content',
  delimiter: '\n\n',
  dataPrefix: 'data: ',
} as const;

export const DEFAULT_HISTORY = {
  userMessageFields: '',
  assistantMessageFields: '',
  historyField: 'messages',
  maxMessages: Infinity,
} as const;

export const DEFAULT_REASONING = {
  mode: 'api_field' as const,
  apiField: 'choices[0].delta.reasoning',
  textPath: 'choices[0].delta.content',
  startMarker: '<thinking>',
  endMarker: '</thinking>',
} as const;

export const DEFAULT_CHAT_REPLY_FIELD = {
  streaming: 'choices[0].delta.content',
  json: 'choices[0].message.content',
};

export const DEFAULT_TIMEOUT = 0;
export const DEFAULT_RETRY = 0;
