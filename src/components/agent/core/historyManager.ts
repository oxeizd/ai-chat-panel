import { DEFAULT_HISTORY } from '../config/defaults';
import { dotGet, dotSet } from '../utils/utils';

export const CONTEXT_KEYS = {
  HISTORY: '__history',
} as const;

/**
 * Извлечение полей из объекта по массиву dot-путей.
 * @param obj - исходный объект
 * @param fields - массив путей, например ["role", "content", "metadata.id"]
 * @returns объект с извлечёнными полями (ключ = последняя часть пути)
 */
function extractFields(obj: any, fields: string[]): any {
  if (!obj || !fields?.length) {
    return {};
  }

  const result: any = {};

  for (const path of fields) {
    const value = dotGet(obj, path);
    if (value !== undefined) {
      const fieldName =
        path
          .replace(/\[.*?\]/g, '')
          .split('.')
          .pop() || path;
      result[fieldName] = value;
    }
  }

  return result;
}

function trimHistory(context: any, max?: number) {
  const h = context[CONTEXT_KEYS.HISTORY];

  if (max && max > 0 && Array.isArray(h) && h.length > max) {
    context[CONTEXT_KEYS.HISTORY] = h.slice(-max);
  }
}

export function injectHistory(body: string | object, context: any, cfg: any): string | object {
  const history = context?.[CONTEXT_KEYS.HISTORY] ?? [];
  const field = cfg?.historyField ?? DEFAULT_HISTORY.historyField;

  let resultObj: any;

  if (typeof body === 'string') {
    resultObj = JSON.parse(body);
  } else {
    resultObj = { ...(body ?? {}) };
  }

  resultObj[field] = history;
  return typeof body === 'string' ? JSON.stringify(resultObj) : resultObj;
}

export function saveUserMessages(context: any, messages: any[], cfg: any, onTrace?: any) {
  const userMsg = Array.isArray(messages) ? messages[messages.length - 1] : undefined;

  if (!userMsg) {
    return;
  }

  if (!context[CONTEXT_KEYS.HISTORY]) {
    context[CONTEXT_KEYS.HISTORY] = [];
  }

  const history = context[CONTEXT_KEYS.HISTORY];
  const toStore = cfg.userMessageFields?.length ? extractFields(userMsg, cfg.userMessageFields) : { ...userMsg };

  const last = history[history.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(toStore)) {
    return;
  }

  history.push(toStore);
  trimHistory(context, cfg.maxMessages);

  onTrace?.({
    type: 'user_saved',
    timestamp: Date.now(),
    message: toStore,
  });
}

export function saveAssistantMessage(
  context: any,
  sourceData: any,
  replyText: string | undefined,
  reasoningText: string | undefined,
  cfg: any,
  isStreaming?: boolean,
  onTrace?: any
) {
  if (!sourceData && !replyText && !reasoningText) {
    return;
  }

  let toStore: any = {};

  if (isStreaming) {
    if (replyText !== undefined) {
      dotSet(sourceData, 'choices[0].delta.content', replyText);
    }

    if (reasoningText !== undefined) {
      dotSet(sourceData, 'choices[0].delta.reasoning', reasoningText);
    }
  }

  if (cfg.historyConfig.assistantMessageFields?.length && sourceData) {
    toStore = extractFields(sourceData, cfg.historyConfig.assistantMessageFields);
  } else if (sourceData && typeof sourceData === 'object') {
    toStore = { ...sourceData };
  }

  if (Object.keys(toStore).length === 0) {
    return;
  }

  if (!context[CONTEXT_KEYS.HISTORY]) {
    context[CONTEXT_KEYS.HISTORY] = [];
  }

  const history = context[CONTEXT_KEYS.HISTORY];
  const last = history[history.length - 1];

  if (last && JSON.stringify(last) === JSON.stringify(toStore)) {
    return;
  }

  history.push(toStore);
  trimHistory(context, cfg.maxMessages);

  onTrace?.({
    type: 'assistant_saved',
    timestamp: Date.now(),
    message: toStore,
  });
}
