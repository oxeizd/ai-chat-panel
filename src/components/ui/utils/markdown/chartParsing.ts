import JSON5 from 'json5';
import { ChartData } from './chartComponent/types';

/**
 * Снимает бэкслэш-экранирование. Работает итеративно,
 * потому что JSON может быть экранирован несколько раз.
 */
const unescapeVariants = (raw: string): string[] => {
  const variants: string[] = [raw];
  let current = raw;

  for (let i = 0; i < 3; i++) {
    if (!/\\["'\\/bfnrt]/.test(current)) {
      break;
    }

    const next = current
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\');

    if (next === current) {
      break;
    }
    current = next;
    variants.push(current);
  }

  return variants;
};

/**
 * Убирает обёртки ```chart ... ``` и ```json ... ```, если они
 * случайно оказались внутри codeText.
 */
const stripFences = (s: string): string[] => {
  const out: string[] = [s];
  const m = s.match(/```(?:chart|json)?\s*([\s\S]*?)\s*```/i);
  if (m) {
    out.push(m[1].trim());
  }
  return out;
};

/**
 * Если весь блок — JSON-строка с объектом внутри, разворачивает её.
 */
const unwrapJsonString = (s: string): string[] => {
  const out: string[] = [s];
  const trimmed = s.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const inner = JSON.parse(trimmed);
      if (typeof inner === 'string') {
        out.push(inner.trim());
        // возможно, внутри ещё раз обёрнуто
        const innerTrimmed = inner.trim();
        if (innerTrimmed.startsWith('"') && innerTrimmed.endsWith('"')) {
          try {
            const inner2 = JSON.parse(innerTrimmed);
            if (typeof inner2 === 'string') {
              out.push(inner2.trim());
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return out;
};

/**
 * Собирает все стратегии парсинга: строгий JSON → JSON5 → sanitize.
 */
const parsers: Array<(s: string) => unknown> = [
  (s) => JSON.parse(s),
  (s) => JSON5.parse(s),
  (s) => JSON.parse(s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')),
];

/**
 * Основной "мягкий" парсер. Пробует все комбинации
 * {сырой, unescaped, без fences, unwrapped} × {JSON, JSON5, sanitize}.
 */
const tryParseLoose = (raw: string): unknown => {
  // Базовая очистка
  const base = raw
    .replace(/^\uFEFF/, '')
    .trim()
    // висячие запятые
    .replace(/,\s*([}\]])/g, '$1');

  // Все варианты текста
  const textVariants = new Set<string>();
  for (const v of unescapeVariants(base)) {
    textVariants.add(v);
    for (const stripped of stripFences(v)) {
      textVariants.add(stripped);
      for (const unwrapped of unwrapJsonString(stripped)) {
        textVariants.add(unwrapped);
      }
    }
    // unwrap до strip — на случай "```chart ...```"
    for (const unwrapped of unwrapJsonString(v)) {
      textVariants.add(unwrapped);
      for (const stripped of stripFences(unwrapped)) {
        textVariants.add(stripped);
      }
    }
  }

  let lastError: unknown;
  for (const variant of textVariants) {
    for (const parse of parsers) {
      try {
        return parse(variant);
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Не удалось распарсить JSON');
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
