export interface AgentConfig {
  name: string;
  api: string;
  default: boolean;
  endpoints: EndpointConfig[];
  workflow: string[];
  startupOperation: string;
}

export interface EndpointConfig {
  operation: string;
  method: string;
  path: string;
  headers?: Record<string, string>; // объект, не строка
  body?: Record<string, any>; // объект, не строка
  saveToContext: string[]; // ключи, которые нужно сохранить в контекст
  replyField?: string; // альтернативное поле для извлечения ответа
  polling?: PollingConfig;
  streaming?: boolean | StreamingConfig;
  conversationHistory?: boolean | ConversationHistoryConfig;
  reasoning?: ReasoningConfig;
}

export interface PollingConfig {
  enabled?: boolean;
  intervalMs?: number;
  maxAttempts?: number;
  statusField?: string;
  successValue?: string;
  resultField?: string;
  retryStatusCodes?: number[];
}

export interface StreamingConfig {
  enabled: boolean;
  textPath?: string; // путь к текстовому содержимому в чанке (например, "choices.0.delta.content")
  delimiter?: string; // разделитель сообщений SSE
  dataPrefix?: string; // префикс данных ("data: ")
}

export interface ConversationHistoryConfig {
  enabled: boolean;
  userMessageFields?: string[]; // поля для сохранения сообщения пользователя
  assistantMessageFields?: string[]; // поля для сообщения ассистента
  historySync?: {
    eventType: string; // тип события-снимка (например, "MESSAGES_SNAPSHOT")
    messagesPath: string; // путь к массиву сообщений в событии (например, "messages")
  };
}

export interface EmbeddedReasoning {
  enabled: true;
  format: 'embedded';
  mode: 'api_field' | 'thinking_tags';
  apiField?: string;
  textPath?: string;
  startMarker?: string;
  endMarker?: string;
}

export interface SeparateReasoning {
  enabled: true;
  format: 'separate';
  eventMapping?: {
    thinkingStart?: string;
    thinkingContent?: string;
    thinkingEnd?: string;
  };
}

export type ReasoningConfig = false | EmbeddedReasoning | SeparateReasoning;

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

export interface DebugTrace {
  userMessageId: string;
  userInput: string;
  steps: TraceStep[];
  finalReply?: string;
  error?: any;
}

export interface TraceStep {
  type: 'request' | 'response' | 'polling' | 'context_update' | 'sse_parse_error' | 'error';
  timestamp: number;
  endpoint?: EndpointConfig;
  url?: string;
  method?: string;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  pollingAttempt?: number;
  contextChanges?: Record<string, any>;
  error?: any;
  line?: string;
  errorMessage?: string;
}
