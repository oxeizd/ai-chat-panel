export interface AgentConfig {
  name: string;
  url: string;
  default: boolean;
  endpoints: EndpointConfig[];
  startupOperation: string;
  workflow: string[];
}

export interface EndpointConfig {
  operation: string;
  method: string;
  path: string;
  headers?: Record<string, string> | null;
  body?: Record<string, any> | null;
  saveToContext?: string[];
  replyField?: string;
  polling?: PollingConfig;
  reasoning?: ReasoningConfig;
  streaming?: StreamingConfig;
  historyConfig?: ChatHistoryConfig;
  url?: string;
  fileField?: string;
}

export type PollingConfig =
  | { enabled: false }
  | {
      enabled: true;
      intervalMs?: number;
      maxAttempts?: number;
      statusField?: string;
      successValue?: string;
      resultField?: string;
      retryStatusCodes?: number[];
    };

export type StreamingConfig =
  | { enabled: false }
  | {
      enabled: true;
      parseStrategy: 'sse' | 'jsonl';
      textPath?: string;
      delimiter?: string;
      dataPrefix?: string;
    };

export type ChatHistoryConfig =
  | { enabled: false }
  | {
      enabled: true;
      mode: 'local';
      userMessageFields?: string[];
      assistantMessageFields?: string[];
      historyField?: string;
      maxMessages?: number;
    }
  | {
      enabled: true;
      mode: 'incoming_sync';
      historySync: {
        eventType: string;
        messagesPath: string;
      };
    };

export type ReasoningConfig =
  | { enabled: false }
  | {
      enabled: true;
      type: 'embedded';
      mode: 'api_field' | 'thinking_tags';
      apiField?: string;
      textPath?: string;
      startMarker?: string;
      endMarker?: string;
    }
  | {
      enabled: true;
      type: 'separate';
      eventType?: string;
      contentField?: string;
      resultField?: string;
    };

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  error?: boolean;
  errorDetails?: {
    status?: number;
    message: string;
    raw?: string;
  };
  fileAttachment?: {
    filename: string;
    data: string;
    mimeType?: string;
    isUrl?: boolean;
  };
  thinking?: string;
  isThinking?: boolean;
}

export interface TraceStep {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export interface DebugTrace {
  userMessageId: string;
  userInput: string;
  steps: TraceStep[];
  finalReply?: string;
  error?: any;
}

export interface Session {
  started: boolean;
  context: Record<string, any>;
}

export interface SendResult {
  ok: boolean;
  data?: any;
  error?: string;
  context?: Record<string, any>;
  isStreaming?: boolean;
  reasoningText?: string;
  lastEvent?: any;
  fileAttachment?: any;
}

/**
 * Конфигурация одного HTTP-запроса.
 */
export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  onTrace?: (step: TraceStep) => void;
}

/**
 * Унифицированный HTTP-ответ (обёртка над стандартным Response).
 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  clone(): HttpResponse;
  text(): Promise<string>;
  json(): Promise<any>;
}

export type AgentEvent =
  | { type: 'chunk'; payload: string }
  | { type: 'reasoning:start'; payload?: { title?: string } }
  | { type: 'reasoning:chunk'; payload: string }
  | { type: 'reasoning:end'; payload: string }
  | { type: 'contextUpdate'; payload: Record<string, any> }
  | { type: 'fileAttachment'; payload: any };
