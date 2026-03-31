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
}

export interface AgentConfig {
  /** Отображаемое имя агента */
  name: string;
  /** URL эндпоинта API для этого агента */
  api: string;
  /** JSON-конфигурация агента (дополнительные параметры) */
  config?: string;
  default?: boolean;
}

export interface Message {
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export interface RecommendedQuestion {
  id: number;
  json?: string;
}
