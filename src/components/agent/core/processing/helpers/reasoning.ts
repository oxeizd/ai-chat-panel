import { EventBus } from '../../eventBus';
import { EndpointConfig, ReasoningConfig } from 'types';
import { extractValueByPath } from 'components/agent/shared/utils/objectHelpers';

export interface ExtractReasoningResult {
  reasoningText?: string;
  cleanReply: string;
}

/**
 * Извлекает reasoning из полного JSON-ответа (не потокового).
 */
export function extractReasoning(
  data: any,
  replyText: string | undefined,
  config: ReasoningConfig,
  eventBus: EventBus
): ExtractReasoningResult {
  const originalReply = replyText ?? '';

  if (!config.enabled) {
    return { cleanReply: originalReply };
  }

  const mode = config.mode ?? 'both';
  const useApiField = mode === 'api_field' || mode === 'both';
  const useThinkingTags = mode === 'thinking_tags' || mode === 'both';

  let reasoningText: string | undefined;
  let cleanReply = originalReply;

  // 1. Извлечение из API-поля (по кастомному пути)
  if (useApiField) {
    const apiField = config.apiField ?? 'choices[0].delta.reasoning_content';
    const extracted = extractValueByPath(data, apiField);
    if (typeof extracted === 'string' && extracted.trim().length > 0) {
      reasoningText = extracted;
    } else if (Array.isArray(extracted)) {
      const joined = extracted.filter((item) => item && typeof item === 'string').join('\n');
      if (joined) {
        reasoningText = joined;
      }
    }
  }

  // 2. Извлечение из тегов <thinking> внутри replyText
  if (useThinkingTags && cleanReply) {
    const startMarker = config.startMarker ?? '<thinking>';
    const endMarker = config.endMarker ?? '</thinking>';

    let reasoningFromTags = '';
    let textWithoutTags = cleanReply;

    let startIdx = textWithoutTags.indexOf(startMarker);
    while (startIdx !== -1) {
      const endIdx = textWithoutTags.indexOf(endMarker, startIdx + startMarker.length);
      if (endIdx !== -1) {
        reasoningFromTags +=
          (reasoningFromTags ? '\n' : '') + textWithoutTags.substring(startIdx + startMarker.length, endIdx);
        textWithoutTags = textWithoutTags.substring(0, startIdx) + textWithoutTags.substring(endIdx + endMarker.length);
        startIdx = textWithoutTags.indexOf(startMarker);
      } else {
        break;
      }
    }

    if (reasoningFromTags) {
      reasoningText = reasoningText ? `${reasoningText}\n${reasoningFromTags}` : reasoningFromTags;
      cleanReply = textWithoutTags;
    }
  }

  // 3. Эмит событий, если reasoning найден
  if (reasoningText) {
    eventBus.emit('thinkingStart');
    eventBus.emit('reasoningChunk', reasoningText);
    eventBus.emit('reasoningComplete', reasoningText);
    eventBus.emit('thinkingEnd');
  }

  // 4. Гарантируем, что cleanReply не undefined и не пустая строка, если был оригинальный replyText
  if (cleanReply === '' && originalReply) {
    cleanReply = originalReply;
  }

  return { reasoningText, cleanReply };
}

/**
 * Извлекает содержимое тегов мышления и очищает текст от этих тегов.
 * (Оставляем для обратной совместимости, но внутри используется выше)
 */
export const extractTagReasoning = (
  text: string,
  startMarker = '<thinking>',
  endMarker = '</thinking>'
): { reasoning: string; cleanText: string } => {
  let reasoning = '';
  let cleanText = text;

  let startIdx = cleanText.indexOf(startMarker);
  while (startIdx !== -1) {
    const endIdx = cleanText.indexOf(endMarker, startIdx + startMarker.length);
    if (endIdx !== -1) {
      const inside = cleanText.substring(startIdx + startMarker.length, endIdx);
      reasoning += (reasoning ? '\n' : '') + inside;
      cleanText = cleanText.substring(0, startIdx) + cleanText.substring(endIdx + endMarker.length);
      startIdx = cleanText.indexOf(startMarker);
    } else {
      break;
    }
  }

  return { reasoning, cleanText };
};

export const getReasoningConfig = (endpoint: EndpointConfig): ReasoningConfig => {
  const raw = endpoint.reasoning;
  if (typeof raw === 'object' && raw !== null) {
    return raw;
  }
  if (raw === true) {
    return {
      enabled: true,
      mode: 'both',
      apiField: 'choices[0].delta.reasoning_content',
      textPath: 'choices[0].delta.content',
      startMarker: '<thinking>',
      endMarker: '</thinking>',
    };
  }
  return { enabled: false };
};
