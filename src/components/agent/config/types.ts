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
  /** Опциональная операция удаления треда истории. Если не задана — удаление только локальное (из списка в UI). */
  historyDeleteOperation?: string;
  /**
   * Имя ключа в context агента, где хранится id текущего треда/чата
   * (обычно заполняется через saveToContext на эндпоинте отправки сообщения).
   * По умолчанию 'thread_id' — но у вашего backend поле может называться иначе.
   */
  threadIdContextKey?: string;
  /**
   * Имя параметра, с которым id треда передаётся в historyLoadOperation /
   * historyDeleteOperation (через additionalContext -> шаблон {param} в url/body).
   * Если не задан явно — наследует threadIdContextKey.
   */
  threadIdParam?: string;
  /** Dot-пути полей элемента списка тредов (ответ historyListOperation). */
  historyListItemFields?: HistoryListItemFields;
  /** Dot-пути полей одного сообщения треда (ответ historyLoadOperation). */
  historyMessageFields?: HistoryMessageFields;
  /**
   * Подсказки, специфичные для этого агента (формат — строка с разделителем
   * ";"). Используются, только если suggestionsSource === 'static' (или не
   * задан). Если пусто — используются общие подсказки панели как фолбэк.
   */
  suggestions?: string;
  /**
   * Источник подсказок для этого агента:
   * - 'static' (по умолчанию) — берутся из поля suggestions выше, руками.
   * - 'dynamic_once' — тянутся от агента ОДИН РАЗ при старте новой сессии
   *   (открытие панели, смена агента, "Новый чат"), дальше держатся как
   *   есть до следующего старта сессии.
   * - 'dynamic_per_reply' — обновляются от агента после КАЖДОГО ответа
   *   ассистента.
   * Оба dynamic-режима читают значение из dynamicSuggestionsContextKey,
   * различается только момент вызова suggestionsOperation.
   */
  suggestionsSource?: 'static' | 'dynamic_once' | 'dynamic_per_reply';
  /**
   * Имя ключа в context, куда попадают подсказки — либо напрямую из ответа
   * send-эндпоинта (если он сам возвращает подсказки вместе с репликой, через
   * его собственный saveToContext), либо из ответа suggestionsOperation ниже
   * (через её saveToContext). Значение может быть массивом строк или строкой
   * с разделителем ";".
   */
  dynamicSuggestionsContextKey?: string;
  /**
   * Опциональная отдельная операция для получения подсказок. Вызывается
   * автоматически (не блокируя основной чат):
   * - один раз при старте сессии, если suggestionsSource === 'dynamic_once';
   * - после каждого ответа ассистента, если suggestionsSource === 'dynamic_per_reply'.
   * Результат попадает в dynamicSuggestionsContextKey через saveToContext,
   * настроенный на этой операции. Если не задана (актуально только для
   * dynamic_per_reply) — ожидается, что send-эндпоинт возвращает подсказки
   * сам, в том же ответе.
   */
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

/** Нормализованный элемент списка тредов истории для отображения в UI. */
export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  preview?: string;
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
  | { type: 'fileAttachment'; payload: any };
