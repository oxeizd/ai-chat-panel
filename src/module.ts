import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { ChatPanel } from './components/ChatPanel';
import { AgentsEditor } from './components/editors/AgentsEditor';

export const plugin = new PanelPlugin<PanelOptions>(ChatPanel).setPanelOptions((builder) => {
  return builder
    .addBooleanSwitch({
      path: 'inlineMode',
      name: 'Inline mode',
      description: 'Display chat inside panel instead of floating',
      defaultValue: false,
    })
    .addTextInput({
      path: 'placeholderText',
      name: 'Placeholder text',
      description: 'Text to show when chat is empty',
      defaultValue: '',
    })
    .addNumberInput({
      path: 'maxWidth',
      name: 'Max width (px)',
      description: 'Ограничить максимальную ширину чата (0 - без ограничений)',
      defaultValue: 0,
    })
    .addBooleanSwitch({
      path: 'centerInput',
      name: 'Center input',
      description: 'Центрировать поле ввода по горизонтали (только для инлайн-режима)',
      defaultValue: false,
    })
    .addTextInput({
      path: 'welcomeMessage',
      name: 'Welcome message',
      description: 'Приветственный текст над чатом',
      defaultValue: '',
    })
    .addBooleanSwitch({
      path: 'showWelcomeMessage',
      name: 'Show welcome message',
      description: 'Показывать приветствие',
      defaultValue: false,
    })
    .addTextInput({
      path: 'suggestions',
      name: 'Suggestions (comma separated)',
      description: 'Рекомендации, разделённые запятыми',
      defaultValue: '',
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
    })
    .addCustomEditor({
      id: 'agents',
      path: 'agents',
      name: 'Agents',
      description: 'Configure AI agents',
      editor: AgentsEditor,
      defaultValue: [],
    });
});
