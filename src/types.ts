export interface PanelOptions {
  chatMode?: 'floating' | 'inline' | 'button';
  chatStyles: {
    centerInput?: boolean;
    centerFloatingChat?: boolean;
    buttonText?: string;
    placeholderText?: string;
    maxWidth?: number;
    inputAreaBackground?: boolean;
  };
  settings: {
    openFullscreen?: boolean;
    showWelcomeMessage?: boolean;
    welcomeMessage?: string;
    showSuggestions?: boolean;
    suggestions?: string;
    suggestionsPlacement?: 'always' | 'onFocus';
  };
  agents: AgentConfig[];
  debug?: boolean;
}

export interface PollingConfig {
  enabled: boolean;
  intervalMs?: number;
  maxAttempts?: number;
  statusField?: string;
  successValue?: string;
  resultField?: string;
  retryStatusCodes?: number[];
}

export interface EndpointConfig {
  operation: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: any;
  replyField?: string;
  saveToContext?: string[];
  polling?: PollingConfig;
  streaming?: boolean | StreamingConfig; // новое поле
  preserveConversationHistory?: boolean; // включать ли историю сообщений
  assistantMessageFields?: string[]; // какие поля из ответа сохранить вместе с сообщением ассистента (например, ['reasoning_details'])
}

export interface StreamingConfig {
  enabled: boolean;
  textPath?: string; // путь к тексту в JSON-фрагменте, по умолчанию 'choices[0].delta.content'
  delimiter?: string; // разделитель событий, по умолчанию '\n\n'
  dataPrefix?: string; // префикс данных, по умолчанию 'data: '
}

export interface AgentConfig {
  name: string;
  api: string; // базовый URL
  default?: boolean;
  config?: string; // общие параметры для тела запроса (JSON)
  headers?: string; // общие заголовки для всех запросов (JSON)
  endpoints?: EndpointConfig[];
  workflow?: string[];
  startupOperation?: string;
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
