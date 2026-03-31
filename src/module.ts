import { PanelPlugin } from '@grafana/data';
import { PanelOptions } from './types';
import { ChatPanel } from './components/ChatPanel';
import { AgentsEditor } from './components/AgentsEditor';

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
    .addCustomEditor({
      id: 'agents',
      path: 'agents',
      name: 'Agents',
      description: 'Configure AI agents',
      editor: AgentsEditor,
      defaultValue: [],
    });
});