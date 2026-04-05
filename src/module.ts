import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { ChatPanel } from './components/ChatPanel';
import { AgentsEditor } from './components/editors/agentEditor/AgentsEditor';

export const plugin = new PanelPlugin<PanelOptions>(ChatPanel).setPanelOptions((builder) => {
  return builder
    .addRadio({
      path: 'chatMode',
      name: 'Chat mode',
      defaultValue: 'floating',
      settings: {
        options: [
          { label: 'Floating', value: 'floating' },
          { label: 'Inline', value: 'inline' },
          { label: 'Button', value: 'button' },
        ],
      },
      category: ['Mode settings'],
    })
    .addBooleanSwitch({
      path: 'centerInput',
      name: 'Center start input position',
      defaultValue: false,
      category: ['Mode settings'],
      showIf: (config) => config.chatMode === 'floating',
    })
    .addBooleanSwitch({
      path: 'centerFloatingChat',
      name: 'Center chat',
      defaultValue: false,
      category: ['Mode settings'],
      showIf: (config) => config.chatMode === 'floating',
    })
    .addTextInput({
      path: 'buttonText',
      name: 'Button text',
      description: 'Text on the button that opens the chat',
      defaultValue: 'Open Chat',
      category: ['Mode settings'],
      showIf: (config) => config.chatMode === 'button',
    })
    .addBooleanSwitch({
      path: 'fullscreen',
      name: 'Open in fullscreen',
      defaultValue: false,
      category: ['Mode settings'],
    })
    .addNumberInput({
      path: 'maxWidth',
      name: 'Max width',
      defaultValue: 0,
      category: ['Chat options'],
    })
    .addTextInput({
      path: 'placeholderText',
      name: 'Placeholder text',
      description: 'Text to show when chat is empty',
      defaultValue: '',
      category: ['Chat options'],
    })
    .addBooleanSwitch({
      path: 'showWelcomeMessage',
      name: 'Show welcome message',
      description: 'Показывать приветствие',
      defaultValue: false,
      category: ['Chat options'],
    })
    .addTextInput({
      path: 'welcomeMessage',
      name: 'Welcome message',
      description: 'Приветственный текст над чатом',
      defaultValue: '',
      category: ['Chat options'],
      showIf: (config) => config.showWelcomeMessage === true,
    })
    .addBooleanSwitch({
      path: 'showSuggestions',
      name: 'Show suggestions',
      description: 'Display suggestions',
      defaultValue: false,
      category: ['Chat options'],
    })
    .addTextInput({
      path: 'suggestions',
      name: 'Suggestions',
      description: 'Рекомендации, разделитель ";"',
      defaultValue: '',
      category: ['Chat options'],
      showIf: (config) => config.showSuggestions === true,
    })
    .addRadio({
      path: 'suggestionsPlacement',
      name: 'Suggestions placement',
      description: 'Как показывать рекомендации',
      settings: {
        options: [
          { label: 'Always', value: 'always' },
          { label: 'On focus', value: 'onFocus' },
        ],
      },
      defaultValue: 'always',
      category: ['Chat options'],
      showIf: (config) => config.showSuggestions === true,
    })
    .addCustomEditor({
      id: 'agents',
      path: 'agents',
      name: 'Agents',
      editor: AgentsEditor,
      defaultValue: [],
      category: ['Agent options'],
    })
    .addBooleanSwitch({
      path: 'debug',
      name: 'Debug mode',
      description: 'Enable debug traces (click on user message to see full request flow)',
      defaultValue: false,
      category: ['Debug'],
    });
});
