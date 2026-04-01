export interface PanelOptions {
  /** Режим отображения: плавающий чат поверх панели или внутри */
  inlineMode?: boolean;

  /** Текст-заглушка, когда чат пуст */
  placeholderText?: string;

  /** Загружать рекомендуемые вопросы при инициализации панели */
  fetchRecommendedQuestions?: boolean;

  /** Список агентов с их конфигурацией */
  agents: AgentConfig[];
  agentsJson?: string;
  maxWidth?: number;          // максимальная ширина чата в пикселях
  centerInput?: boolean;      // центрировать поле ввода по горизонтали
  welcomeMessage?: string;    // текст приветствия
  showWelcomeMessage?: boolean; // показывать приветствие
  suggestions?: string;     // массив рекомендаций
  suggestionsPlacement?: 'always' | 'onFocus'; // как показывать рекомендации
}

export interface PollingConfig {
  enabled: boolean;
  intervalMs?: number;
  maxAttempts?: number;
  statusField?: string;
  successValue?: string;
  resultField?: string;
}

export interface EndpointConfig {
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: string;
  saveToContext?: string[];
  polling?: PollingConfig;
  headers?: Record<string, string>;
}

export interface AgentConfig {
  name: string;
  api: string;
  default: boolean;
  config?: string;
  endpoints?: EndpointConfig[];
  workflow?: string[];
  startupOperation?: string;
}

export interface Message {
  id: string; 
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export interface ChatStyle {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  width: number;
}
