import { DEFAULT_HISTORY } from '../config/defaults';
import { EndpointConfig, TraceStep } from 'types';

export const CONTEXT_KEYS = {
  HISTORY: '__history',
} as const;

function pickFields(obj: any, fields: string[]): any {
  const res: any = {};
  for (const f of fields) {
    if (obj[f] !== undefined) {
      res[f] = obj[f];
    }
  }
  return res;
}

function trimHistory(context: any, max?: number) {
  const h = context[CONTEXT_KEYS.HISTORY];
  if (max && max > 0 && Array.isArray(h) && h.length > max) {
    context[CONTEXT_KEYS.HISTORY] = h.slice(-max);
  }
}

/** Внедрить историю в поле messages (или historyField) */
export function injectHistory(body: string | object, context: any, cfg: any): string | object {
  const history = context[CONTEXT_KEYS.HISTORY] || [];
  const field = cfg.historyField ?? DEFAULT_HISTORY.historyField;
  let obj: any = typeof body === 'string' ? JSON.parse(body) : { ...body };
  obj[field] = history;
  return typeof body === 'string' ? JSON.stringify(obj) : obj;
}

/** Сохранить сообщение пользователя (последнее с role=user) */
export function saveUserMessages(context: any, rawMessages: any[], cfg: any, onTrace?: any) {
  const userMsg = rawMessages.filter((m) => m?.role === 'user').pop();
  if (!userMsg) {
    return;
  }
  if (!context[CONTEXT_KEYS.HISTORY]) {
    context[CONTEXT_KEYS.HISTORY] = [];
  }
  const history = context[CONTEXT_KEYS.HISTORY];
  const last = history[history.length - 1];
  const toStore = cfg.userMessageFields?.length ? pickFields(userMsg, cfg.userMessageFields) : { ...userMsg };
  // Проверяем, не совпадает ли с последним user-сообщением
  if (last && last.role === 'user' && last.content === toStore.content) {
    return;
  }
  history.push(toStore);
  onTrace?.({ type: 'user_saved', timestamp: Date.now(), message: toStore });
  trimHistory(context, cfg.maxMessages);
}

/** Сохранить сообщение ассистента */
export function saveAssistantMessage(
  context: any,
  assistantData: any,
  replyText: string | undefined,
  reasoningText: string | undefined,
  cfg: any,
  onTrace?: any
) {
  if (!replyText && !assistantData && !reasoningText) {
    return;
  }
  let toStore = cfg.assistantMessageFields?.length
    ? pickFields(assistantData || {}, cfg.assistantMessageFields)
    : { ...(assistantData || {}) };

  if (toStore.content === undefined && replyText) {
    toStore.content = replyText;
  }
  if (toStore.role === undefined) {
    toStore.role = 'assistant';
  }
  if (reasoningText) {
    toStore.reasoning = reasoningText;
  }
  if (Object.keys(toStore).length === 0) {
    return;
  }

  if (!context[CONTEXT_KEYS.HISTORY]) {
    context[CONTEXT_KEYS.HISTORY] = [];
  }

  const history = context[CONTEXT_KEYS.HISTORY];
  const last = history[history.length - 1];
  const isDuplicate = last && last.role === 'assistant' && last.content === toStore.content;
  if (!isDuplicate) {
    history.push(toStore);
    onTrace?.({ type: 'assistant_saved', timestamp: Date.now(), message: toStore });
    trimHistory(context, cfg.maxMessages);
  }
}

/**
 * Единая точка сохранения истории для локального режима (только ассистент).
 * User-сообщение сохраняется до запроса в buildRequestConfig.
 */
export function recordChatHistory(
  context: Record<string, any>,
  op: EndpointConfig,
  replyText: string | undefined,
  reasoningText: string | undefined,
  onTrace?: (step: TraceStep) => void
): void {
  const h = op.historyConfig;
  if (!h?.enabled || h.mode !== 'local') {
    return;
  }

  // Сохраняем только ответ ассистента (user уже сохранён до запроса)
  if (replyText !== undefined || reasoningText !== undefined) {
    saveAssistantMessage(context, null, replyText, reasoningText, h, onTrace);
  }
}
