import { EndpointConfig, ReasoningConfig } from 'types';

/**
 * Возвращает нормализованную конфигурацию reasoning для эндпоинта.
 * Если reasoning = true, подставляет дефолтные значения.
 * Если reasoning = false/undefined, возвращает { enabled: false }.
 */
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

/**
 * Извлекает содержимое тегов мышления и очищает текст от этих тегов.
 * @param text - полный текст (или чанк) для разбора
 * @param startMarker - открывающий маркер (по умолчанию '<thinking>')
 * @param endMarker - закрывающий маркер (по умолчанию '</thinking>')
 * @returns объект с полями:
 *   - reasoning: содержимое тегов (может быть пустой строкой)
 *   - cleanText: текст без тегов и их содержимого
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
