import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { ChatPanel } from './components/ChatPanel';
import { AgentsEditor } from './components/editor/agentsEditor';

export const plugin = new PanelPlugin<PanelOptions>(ChatPanel).setPanelOptions((builder) => {
  return (
    builder
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
        path: 'chatStyles.centerInput',
        name: 'Center start input position',
        defaultValue: false,
        category: ['Style options'],
        showIf: (config) => config.chatMode === 'floating',
      })
      .addBooleanSwitch({
        path: 'chatStyles.inputAreaBackground',
        name: 'input area backgorund',
        defaultValue: false,
        category: ['Style options'],
        showIf: (config) => config.chatMode === 'floating',
      })
      .addBooleanSwitch({
        path: 'chatStyles.centerFloatingChat',
        name: 'Center chat',
        defaultValue: false,
        category: ['Style options'],
        showIf: (config) => config.chatMode === 'floating',
      })
      .addTextInput({
        path: 'chatStyles.buttonText',
        name: 'Button text',
        description: 'Text on the button that opens the chat',
        defaultValue: 'Open Chat',
        category: ['Style options'],
        showIf: (config) => config.chatMode === 'button',
      })
      .addNumberInput({
        path: 'chatStyles.maxWidth',
        name: 'Max width',
        defaultValue: 0,
        category: ['Style options'],
      })
      .addTextInput({
        path: 'settings.placeholderText',
        name: 'Placeholder text',
        description: 'Text to show when chat is empty',
        defaultValue: '',
        category: ['Chat options'],
      })
      .addBooleanSwitch({
        path: 'settings.showWelcomeMessage',
        name: 'Show welcome message',
        description: 'Показывать приветствие',
        defaultValue: false,
        category: ['Chat options'],
      })
      .addTextInput({
        path: 'settings.welcomeMessage',
        name: 'Welcome message',
        description: 'Приветственный текст над чатом',
        defaultValue: '',
        category: ['Chat options'],
        settings: {
          rows: 2,
          useTextarea: true,
        },
        showIf: (config) => config.settings.showWelcomeMessage === true,
      })
      .addBooleanSwitch({
        path: 'settings.showSuggestions',
        name: 'Show suggestions',
        description: 'Display suggestions',
        defaultValue: false,
        category: ['Chat options'],
      })
      .addTextInput({
        path: 'settings.suggestions',
        name: 'Suggestions',
        description: 'Рекомендации, разделитель ";"',
        defaultValue: '',
        category: ['Chat options'],
        settings: {
          rows: 3,
          useTextarea: true,
        },
        showIf: (config) => config.settings.showSuggestions === true,
      })
      .addRadio({
        path: 'settings.suggestionsPlacement',
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
        showIf: (config) => config.settings.showSuggestions === true,
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
      })
  );
});
