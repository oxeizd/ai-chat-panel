import { AgentConfig } from 'types';

export const CHAT_SETTINGS = {
  targetHeight: 650, // желаемая высота
  minHeight: 500, // минимальная высота
  viewportLimit: 0.95, // максимальная доля от высоты экрана
  margin: 8,
  positionOffset: 65,
  inputWrapperHeight: 150, // примерная высота области ввода + шапка + кнопки
};

export const DEFAULT_PLACEHOLDER_TEXT = 'Введите сообщение...';

export const DEFAULT_AGENT: AgentConfig = {
  name: 'Агент по умолчанию',
  api: 'YOUR_AI_AGENT_API_ENDPOINT',
  default: true
};

export const MESSAGES = {
  sendPlaceholder: 'Введите сообщение...',
  sendPlaceholderMultiline: 'Введите сообщение... (Shift+Enter для отправки)',
  errorResponse: '❌ Не удалось получить ответ. Проверьте соединение.',
  defaultPlaceholder: 'Чат пуст. Начните диалог!',
};
