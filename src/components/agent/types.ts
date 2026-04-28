export interface AgentConfig {
  name: string;
  api: string;
  default: boolean;
  config?: Record<string, any>;
  headers?: Record<string, string>;
  endpoints: EndpointConfig[];
  workflow: string[];
  startupOperation: string;
}

export interface EndpointConfig {
  operation: string;
  method: string;
  path: string;
  body?: Record<string, any>; // объект, не строка
  saveToContext: string[];
  polling?: PollingConfig;
  headers?: Record<string, string>; // объект, не строка
  replyField?: string;
  streaming?: boolean | StreamingConfig;
  preserveConversationHistory?: boolean;
  userMessageFields?: string[]; // поля из контекста для сообщения пользователя (например, ["id"])
  assistantMessageFields?: string[]; // поля из ответа для сообщения ассистента
  historySync?: {
    eventType: string; // тип события-снимка (например, "MESSAGES_SNAPSHOT")
    messagesPath: string; // путь к массиву сообщений в событии (например, "messages")
  };
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
  textPath?: string;
  delimiter?: string;
  dataPrefix?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  error?: boolean; // флаг ошибки для сообщения пользователя
  errorDetails?: {
    // детали ошибки (для сообщений ai или пользователя)
    status?: number; // HTTP статус или код ошибки
    message: string; // читаемое сообщение
    raw?: string; // сырой ответ сервера
  };
}

export interface TraceStep {
  type: 'request' | 'response' | 'polling' | 'context_update';
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
}

export interface DebugTrace {
  userMessageId: string;
  userInput: string;
  steps: TraceStep[];
  finalReply?: string;
  error?: any;
}
