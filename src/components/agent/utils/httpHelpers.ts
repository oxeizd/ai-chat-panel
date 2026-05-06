import { WorkflowContext } from '../core/ContextManager';
import { mergeObjects } from './objectHelpers';
import { resolveString, resolveObject } from './variableResolver';

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
    if (!relative) return base;
    const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
    const relativeClean = relative.startsWith('/') ? relative : '/' + relative;
    return baseClean + relativeClean;
  };
  return combine(resolvedBaseUrl, path);
};

/**
 * Формирование тела запроса из конфигурации эндпоинта и глобальной конфигурации агента.
 * @param endpoint - конфигурация эндпоинта
 * @param context - контекст
 * @param agentConfig - глобальная конфигурация (объединяется с телом эндпоинта)
 * @returns объединённое тело и его строковое представление
 */
export const buildRequestBody = (
  endpoint: { body?: any },
  context: WorkflowContext,
  agentConfig?: Record<string, any>
): { mergedBody: any; bodyString?: string } => {
  const resolvedAgentConfig = agentConfig ? resolveObject(agentConfig, context) : {};
  const resolvedEndpointBody = endpoint.body ? resolveObject(endpoint.body, context) : {};
  const mergedBody = mergeObjects(resolvedAgentConfig, resolvedEndpointBody);
  let bodyString: string | undefined = undefined;
  if (Object.keys(mergedBody).length > 0) {
    bodyString = JSON.stringify(mergedBody);
  }
  return { mergedBody, bodyString };
};

/**
 * Извлечение текста ответа из данных согласно replyField или стандартным путям.
 * @param data - объект ответа
 * @param replyField - альтернативное поле для извлечения
 * @returns replyText и обновлённый объект data с добавленным полем reply
 */
export const extractReply = (data: any, replyField?: string): { replyText?: string; dataWithReply: any } => {
  let replyText: string | undefined;
  if (replyField) {
    const replyValue = data[replyField];
    if (replyValue !== undefined) replyText = String(replyValue);
  } else {
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
    data.reply = replyText; // мутируем объект для совместимости
  }
  return { replyText, dataWithReply: data };
};

/**
 * Сохранение указанных полей ответа в контекст (или всех, если saveToContext не задан).
 * @param endpoint - конфигурация эндпоинта
 * @param context - мутабельный контекст
 * @param data - данные ответа
 * @param additionalExcludes - дополнительные поля для исключения
 */
export const saveToContext = (
  endpoint: { saveToContext?: string[] },
  context: WorkflowContext,
  data: Record<string, any>,
  additionalExcludes: string[] = []
): void => {
  const exclude = new Set([...additionalExcludes, 'messages']);
  if (endpoint.saveToContext?.length) {
    for (const key of endpoint.saveToContext) {
      if (data[key] !== undefined && !exclude.has(key)) {
        context[key] = data[key];
      }
    }
  } else {
    for (const [key, value] of Object.entries(data)) {
      if (!exclude.has(key)) {
        context[key] = value;
      }
    }
  }
};