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
}

export interface EndpointConfig {
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: string;
  saveToContext?: string[];
  polling?: PollingConfig;
  headers?: Record<string, string>;
  replyField?: string;
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
  padding?: number | string;
}
