import { resolveString } from './variableResolver';
import { WorkflowContext } from 'components/agent/core/execution/contextManager';

/**
 * Построение полного URL эндпоинта с подстановкой переменных.
 * @param endpoint - конфигурация эндпоинта
 * @param context - контекст для подстановки переменных
 * @param baseUrl - базовый URL (может быть пустым, тогда берётся window.location.origin)
 * @returns полный URL
 */
export const buildUrl = (endpoint: { path: string }, context: WorkflowContext, baseUrl: string): string => {
  let resolvedBaseUrl = baseUrl;
  if (!resolvedBaseUrl) {
    resolvedBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (resolvedBaseUrl.startsWith('/')) {
    resolvedBaseUrl = (typeof window !== 'undefined' ? window.location.origin : '') + resolvedBaseUrl;
  }
  const path = resolveString(endpoint.path, context);
  const combine = (base: string, relative: string) => {
    if (!relative) {
      return base;
    }
    const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
    const relativeClean = relative.startsWith('/') ? relative : '/' + relative;
    return baseClean + relativeClean;
  };
  return combine(resolvedBaseUrl, path);
};

/**
 * Извлечение текста ответа из данных согласно replyField или стандартным путям.
 * @param data - объект ответа
 * @param replyField - альтернативное поле для извлечения
 * @returns replyText и обновлённый объект data с добавленным полем reply
 */
export const extractReply = (data: any, replyField?: string): { replyText?: string; dataWithReply: any } => {
  let replyText: string | undefined;

  if (replyField && data[replyField] !== undefined) {
    replyText = String(data[replyField]);
  }

  if (replyText === undefined) {
    if (data.choices?.[0]?.message?.content) {
      replyText = data.choices[0].message.content;
    } else if (data.choices?.[0]?.delta?.content) {
      replyText = data.choices[0].delta.content;
    } else if (data.reply !== undefined) {
      replyText = String(data.reply);
    } else if (data.result !== undefined) {
      replyText = String(data.result);
    }
  }

  if (replyText !== undefined) {
    data.reply = replyText;
  }
  return { replyText, dataWithReply: data };
};
