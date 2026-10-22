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

/** Одно действие (кнопка) в интерактивной подсказке. AG-UI standard: ActionEntry */
export interface ActionEntry {
  /** Текст кнопки */
  label: string;
  /** Значение, отправляемое как сообщение пользователя при выборе. Если не задано — используется label. */
  value?: string;
  /** Если true — при выборе открывается текстовое поле для собственного ответа ("Другое"). */
  allowCustom?: boolean;
}

/** Одно поле формы в интерактивной подсказке. AG-UI standard: FormField */
export interface FormField {
  /** Уникальный идентификатор поля */
  name: string;
  /** Отображаемый лейбл */
  label?: string;
  /** Тип поля: текстовый, числовой, многострочный или выпадающий список */
  type?: 'text' | 'number' | 'textarea' | 'select';
  /** Плейсхолдер для пустого поля */
  placeholder?: string;
  /** Варианты для type: 'select'. */
  options?: string[];
  /** Если true — поле обязательно для заполнения */
  required?: boolean;
}

/**
 * Интерактивная активность — UI-виджет, который агент может отправить
 * через AG-UI ACTIVITY_SNAPSHOT с activityType: "interactive".
 *
 * Отображается в зоне ввода (пока это последнее сообщение и на него не ответили).
 */
export interface InteractiveActivity {
  /** Список кнопок-действий (быстрые варианты ответа) */
  actions?: ActionEntry[];
  /** Форма с полями для заполнения */
  form?: FormField[];
  /** Текст кнопки отправки формы полей. По умолчанию "Отправить". */
  submitLabel?: string;

  // === Legacy aliases for backward compatibility ===
  /** Legacy alias for `actions`. Supports old format from non-AG-UI sources. */
  options?: ActionEntry[];
  /** Legacy alias for `form`. Supports old format from non-AG-UI sources. */
  fields?: FormField[];
}

export type InteractivePayload = InteractiveActivity;

export type InteractiveOption = ActionEntry;

/**
 * Legacy alias for FormField. Kept for backward compatibility with old code.
 */
export type InteractiveField = FormField;

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
  /** Dot-path в теле ответа, где лежит InteractiveActivity (actions/form/submitLabel). */
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
      parseStrategy: 'sse' | 'jsonl' | 'agui';
      textPath?: string;
      delimiter?: string;
      dataPrefix?: string;
      textEventType?: string;
      textDeltaField?: string;
      /** Если true — каждое TEXT_MESSAGE_CONTENT добавляется с новой строки. */
      aguiNewLineBeforeContent?: boolean;
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
  /** Интерактивная активность (кнопки/форма), пришедшая вместе с этим ответом ассистента. */
  interactive?: InteractiveActivity;
  /** AG-UI события (reasoning, tool calls, steps) для отрисовки в истории. */
  traceSteps?: TraceStep[];
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
  interactive?: InteractiveActivity;
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
  | { type: 'interactive'; payload: InteractiveActivity }
  | { type: 'custom'; payload: Record<string, any> };
