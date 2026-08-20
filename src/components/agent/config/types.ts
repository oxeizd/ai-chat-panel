export interface AgentConfig {
  name: string;
  url: string;
  default: boolean;
  endpoints: EndpointConfig[];
  startupOperation: string;
  workflow: string[];
  history: boolean;
  historyListOperation?: string;
  historyLoadOperation?: string;
  historyDeleteOperation?: string;
  threadIdContextKey?: string;
  threadIdParam?: string;
  historyListItemFields?: HistoryListItemFields;
  historyMessageFields?: HistoryMessageFields;
  suggestions?: string;
  suggestionsSource?: 'static' | 'dynamic_once' | 'dynamic_per_reply';
  dynamicSuggestionsContextKey?: string;
  suggestionsOperation?: string;
}

export interface HistoryListItemFields {
  id?: string;
  title?: string;
  date?: string;
  preview?: string;
}

export interface HistoryMessageFields {
  role?: string;
  text?: string;
  id?: string;
  timestamp?: string;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  preview?: string;
}

/** Один вариант выбора в интерактивной подсказке. */
export interface InteractiveOption {
  label: string;
  /** Значение, отправляемое как сообщение пользователя при выборе. Если не задано — используется label. */
  value?: string;
  /** Если true — при выборе открывается текстовое поле для собственного ответа ("Другое"). */
  allowCustom?: boolean;
}

/** Одно поле формы в интерактивной подсказке. */
export interface InteractiveField {
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  /** Варианты для type: 'select'. */
  options?: string[];
  required?: boolean;
}

/**
 * Структура, которую агент может вернуть вместе с ответом (через
 * EndpointConfig.interactiveField, dot-path в теле ответа) — набор кнопок-
 * вариантов и/или форма полей. Отображается не под сообщением ассистента,
 * а в зоне ввода (пока это последнее сообщение и на него не ответили).
 */
export interface InteractivePayload {
  options?: InteractiveOption[];
  fields?: InteractiveField[];
  /** Текст кнопки отправки формы полей. По умолчанию "Отправить". */
  submitLabel?: string;
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
  /** Dot-path в теле ответа, где лежит InteractivePayload (варианты/поля для этого ответа). */
  interactiveField?: string;
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
      textEventType?: string;
      textDeltaField?: string;
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
  /** Карточка с вариантами/полями, пришедшая вместе с этим ответом ассистента. */
  interactive?: InteractivePayload;
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
  interactive?: InteractivePayload;
}

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  onTrace?: (step: TraceStep) => void;
}

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
  | { type: 'fileAttachment'; payload: any }
  | { type: 'interactive'; payload: InteractivePayload };
