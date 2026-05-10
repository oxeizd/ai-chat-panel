import { StreamingConfig } from '../../shared/types';

export interface ResolvedReasoningConfig {
  enabled: true;
  format: 'embedded' | 'separate';
  // для embedded
  mode?: 'api_field' | 'thinking_tags';
  apiField?: string;
  textPath?: string;
  startMarker?: string;
  endMarker?: string;
  // для separate
  eventMapping?: {
    thinkingStart: string;
    thinkingContent: string;
    thinkingEnd: string;
  };
}

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
