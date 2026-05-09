// Основные типы конфигурации агента, эндпоинтов, сообщений, трассировки.
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
  saveToContext: string[]; // ключи, которые нужно сохранить в контекст
  polling?: PollingConfig;
  headers?: Record<string, string>; // объект, не строка
  replyField?: string; // альтернативное поле для извлечения ответа
  streaming?: boolean | StreamingConfig;
  conversationHistory?: boolean | ConversationHistoryConfig;
  reasoning?: boolean | ReasoningConfig;
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

/**
 * Настройки извлечения мыслей (reasoning) агента.
 */
export interface ReasoningConfig {
  enabled: boolean;

  /**
   * Режим извлечения мыслей:
   *   'api_field'      – только из отдельного поля API (например, choices[0].delta.reasoning_content)
   *   'thinking_tags'  – только из тегов <thinking>...</thinking> внутри текста ответа
   *   'both'           – и из API, и из тегов (по умолчанию)
   */
  mode?: 'api_field' | 'thinking_tags' | 'both';

  /**
   * Путь к полю reasoning в чанке SSE (для mode='api_field' или 'both').
   * По умолчанию: 'choices[0].delta.reasoning_content'
   */
  apiField?: string;

  /**
   * Путь к текстовому содержимому для поиска тегов (если mode включает thinking_tags).
   * По умолчанию: 'choices[0].delta.content'
   */
  textPath?: string;

  /**
   * Открывающий маркер для thinking_tags.
   * По умолчанию: '<thinking>'
   */
  startMarker?: string;

  /**
   * Закрывающий маркер для thinking_tags.
   * По умолчанию: '</thinking>'
   */
  endMarker?: string;
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

export interface DebugTrace {
  userMessageId: string;
  userInput: string;
  steps: TraceStep[];
  finalReply?: string;
  error?: any;
}
