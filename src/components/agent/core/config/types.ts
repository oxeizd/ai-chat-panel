import { StreamingConfig, ReasoningConfig } from '../../shared/types';

export type ResolvedReasoningConfig = Required<Omit<ReasoningConfig, 'enabled'>> & {
  enabled: true;
};

export type ResolvedStreamingConfig = Required<Omit<StreamingConfig, 'enabled'>> & {
  enabled: true;
};

export interface ResolvedPollingConfig {
  enabled: true;
  intervalMs: number;
  maxAttempts: number;
  statusField: string;
  successValue: string;
  resultField?: string;
  retryStatusCodes: number[];
}

export interface ResolvedConversationHistoryConfig {
  enabled: true;
  userMessageFields?: string[];
  assistantMessageFields?: string[];
  historySync?: {
    eventType: string;
    messagesPath: string;
  };
}

export interface ResolvedEndpointConfig {
  operation: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  saveToContext: string[];
  replyField?: string;
  polling: ResolvedPollingConfig | null;
  reasoning: ResolvedReasoningConfig | null;
  streaming: ResolvedStreamingConfig | null;
  conversationHistory: ResolvedConversationHistoryConfig | null;
}
