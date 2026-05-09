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
