import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { ChatPanel } from './components/ChatPanel';
import { AgentsEditor } from './components/editor/AgentsEditor';

export const plugin = new PanelPlugin<PanelOptions>(ChatPanel).setPanelOptions((builder) => {
  return builder
    .addBooleanSwitch({
      path: 'inlineMode',
      name: 'Inline mode',
      description: 'Display chat inside panel instead of floating',
      defaultValue: false,
      category: ['Mode settings'],
    })
    .addBooleanSwitch({
      path: 'centerInput',
      name: 'Center input position',
      description: 'Центрировать поле ввода',
      defaultValue: false,
      category: ['Mode settings'],
      showIf: (config) => config.inlineMode === false,
    })
    .addNumberInput({
      path: 'maxWidth',
      name: 'Max width',
      description: 'Ограничить максимальную ширину чата',
      defaultValue: 0,
      category: ['Standard settings'],
    })
    .addTextInput({
      path: 'placeholderText',
      name: 'Placeholder text',
      description: 'Text to show when chat is empty',
      defaultValue: '',
      category: ['Standard settings'],
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
    .addSelect({
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
    });
});
