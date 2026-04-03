export interface PanelOptions {
  inlineMode?: boolean;
  placeholderText?: string;
  fetchRecommendedQuestions?: boolean;
  agents: AgentConfig[];
  agentsJson?: string;
  maxWidth?: number;
  centerInput?: boolean;
  welcomeMessage?: string;
  showWelcomeMessage?: boolean;
  showSuggestions?: boolean;
  suggestions?: string;
  suggestionsPlacement?: 'always' | 'onFocus';
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
  method: string;
  path: string;
  body?: string; // JSON строка с поддержкой переменных
  headers?: string; // JSON строка с заголовками
  saveToContext?: string[];
  replyField?: string;
  polling?: PollingConfig;
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

export interface ChatStyle {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  width: number;
  padding?: number | string;
}
