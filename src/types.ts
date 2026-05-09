import { AgentConfig } from 'components/agent/shared/types';

export interface PanelOptions {
  chatMode?: 'floating' | 'inline' | 'button';
  chatStyles: {
    centerInput?: boolean;
    centerFloatingChat?: boolean;
    fullScale?: boolean;
    buttonText?: string;
    maxWidth?: number;
    inputAreaBackground?: boolean;
  };
  settings: {
    placeholderText?: string;
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

export * from 'components/agent/shared/types';
