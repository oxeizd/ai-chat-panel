import JSON5 from 'json5';
import { ChartData } from './chartComponent/types';

/**
 * Достаём JSON из текста code-блока.
 * Пробуем строгий JSON, потом JSON5, потом sanitize + JSON.
 */
const tryParseLoose = (raw: string): unknown => {
  const cleaned = raw
    .replace(/^\uFEFF/, '') // BOM
    .replace(/,\s*([}\]])/g, '$1') // висячие запятые
    .trim();

  // 1. Строгий JSON
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    /* идём дальше */
  }

  // 2. JSON5 (ключи без кавычек, одинарные кавычки, комментарии)
  try {
    return JSON5.parse(cleaned);
  } catch (_) {
    /* идём дальше */
  }

  // 3. Ручная "починка" ключей без кавычек
  const sanitized = cleaned.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  return JSON.parse(sanitized);
};

export const parseChartConfig = (codeText: string): ChartData => {
  const parsed = tryParseLoose(codeText) as ChartData | unknown[];

  if (Array.isArray(parsed)) {
    return { data: parsed } as ChartData;
  }

  return parsed as ChartData;
};

export const isValidChartConfig = (config: ChartData): boolean => {
  return !!(config && (config.datasets || config.data));
};
