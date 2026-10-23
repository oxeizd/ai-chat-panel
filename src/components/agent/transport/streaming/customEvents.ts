import { StreamEventHandler } from 'types';
import { ChartData } from 'components/ui/utils/markdown/chartComponent/types';
import { dotGet } from 'components/agent/utils/utils';

export interface CustomEventResult {
  /** Текст, который нужно дописать в основной ответ (render: 'text'). */
  text?: string;
  /** true — текст направляем в reasoning (спойлер «Думает…»), а не в ответ. */
  intoReasoning?: boolean;
  /** true — перед текстом вставить пустую строку (отдельный абзац). */
  paragraph?: boolean;
  /** График, извлечённый из события (render: 'chart'). */
  chart?: ChartData;
  /** Код для fenced code блока (render: 'code'): уже обёрнут в ```lang ... ```. */
  code?: string;
  /** Остановка потока с ошибкой (render: 'error', либо RUN_ERROR). */
  error?: string;
  /** Значения для session context (render: 'context'). */
  contextUpdate?: Record<string, any>;
}

/**
 * Возвращает первое правило из списка, подходящее под событие, или null.
 * Матчинг: поле `eventTypeField` (default "type") == `eventType`;
 * если задан `eventName` — дополнительно поле `nameField` (default "name") == `eventName`.
 */
export function matchCustomEventHandler(
  event: any,
  rules: StreamEventHandler[] | undefined
): StreamEventHandler | null {
  if (!rules || !rules.length || !event || typeof event !== 'object') {
    return null;
  }

  for (const rule of rules) {
    if (!rule || typeof rule.eventType !== 'string' || !rule.eventType) {
      continue;
    }

    const typeField = rule.eventTypeField ?? 'type';
    const typeValue = event[typeField];

    if (typeof typeValue !== 'string' || typeValue !== rule.eventType) {
      continue;
    }

    if (rule.eventName !== undefined && rule.eventName !== '') {
      const nameField = rule.nameField ?? 'name';
      if (event[nameField] !== rule.eventName) {
        continue;
      }
    }

    return rule;
  }

  return null;
}

/**
 * Извлекает данные события по правилу и приводит их к действию
 * (текст / график / код / контекст / ошибка).
 */
export function applyCustomEventHandler(event: any, rule: StreamEventHandler): CustomEventResult | null {
  const valuePath = rule.valuePath ?? 'value';
  const raw = rule.wholeEvent ? event : dotGet(event, valuePath);

  switch (rule.render) {
    case 'ignore':
      return null;

    case 'text': {
      const text = stringifyValue(raw);
      if (text === undefined) {
        return null;
      }
      return { text, intoReasoning: rule.intoReasoning, paragraph: rule.paragraph !== false };
    }

    case 'code': {
      const text = stringifyValue(raw);
      if (text === undefined) {
        return null;
      }
      const language = rule.language ?? 'json';
      return { text: '```' + language + '\n' + text + '\n```', paragraph: true };
    }

    case 'chart': {
      const chart = normalizeChartData(raw);
      if (!chart) {
        return null;
      }
      return { chart };
    }

    case 'context': {
      if (raw === undefined || !rule.contextKey) {
        return null;
      }
      return { contextUpdate: { [rule.contextKey]: raw } };
    }

    case 'error': {
      const message =
        (typeof event.message === 'string' && event.message) ||
        (typeof raw === 'string' && raw) ||
        rule.errorMessage ||
        'Stream error';
      return { error: message };
    }

    default:
      return null;
  }
}

/** Строковое представление значения: строки как есть, объекты — JSON. */
function stringifyValue(v: any): string | undefined {
  if (typeof v === 'string') {
    return v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (v !== null && typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Приводит различные форматы данных графика к единому ChartData:
 *  - готовый Chart.js-конфиг {type, labels, datasets:[{data:[...]}]};
 *  - AG-UI формат {type, title, data: [{x,y},...], xAxis, yAxis};
 *  - массив точек [{x,y},...] или чисел [1,2,3].
 */
export function normalizeChartData(raw: any): ChartData | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (Array.isArray(raw)) {
    return fromSeriesArray(raw);
  }

  if (typeof raw !== 'object') {
    return null;
  }

  const src: any = raw;

  // Готовый Chart.js-подобный конфиг
  if (Array.isArray(src.datasets) && src.datasets.length > 0) {
    return {
      type: src.type === 'bar' ? 'bar' : 'line',
      labels: src.labels?.map(String),
      datasets: src.datasets.map((ds: any, idx: number) => ({
        label: ds.label ?? `Серия ${idx + 1}`,
        data: Array.isArray(ds.data) ? ds.data.map(Number) : [],
        borderColor: ds.borderColor,
        backgroundColor: ds.backgroundColor,
        borderWidth: ds.borderWidth,
        pointRadius: ds.pointRadius,
        tension: ds.tension,
        fill: ds.fill,
      })),
      title: src.title,
      xAxisTitle: src.xAxisTitle,
      yAxisTitle: src.yAxisTitle,
      showLegend: src.showLegend,
      height: src.height,
      smooth: src.smooth,
      areaOpacity: src.areaOpacity,
    };
  }

  // Вложенный объект chart: {chart: {...}} — например, старая форма CUSTOM-события
  if (src.chart && typeof src.chart === 'object') {
    return normalizeChartData(src.chart);
  }

  // Формат {data: [{x,y}, ...]} — одна серия
  if (Array.isArray(src.data)) {
    const series = fromSeriesArray(src.data);
    if (!series) {
      return null;
    }
    return {
      ...series,
      type: src.type === 'bar' ? 'bar' : src.type === 'line' ? 'line' : series.type,
      title: typeof src.title === 'string' ? src.title : series.title,
      xAxisTitle: typeof src.xAxis === 'string' ? src.xAxis : src.xAxisTitle,
      yAxisTitle: typeof src.yAxis === 'string' ? src.yAxis : src.yAxisTitle,
    };
  }

  return null;
}

/** Массив точек [{x,y}] или чисел [n] → ChartData с одной серией. */
function fromSeriesArray(arr: any[]): ChartData | null {
  if (!arr.length) {
    return null;
  }

  const first = arr[0];

  if (first !== null && typeof first === 'object' && ('x' in first || 'y' in first)) {
    return {
      type: 'line',
      labels: arr.map((p: any) => String(p.x ?? '')),
      datasets: [{ label: 'y', data: arr.map((p: any) => Number(p.y ?? 0)) }],
    };
  }

  if (typeof first === 'number') {
    return {
      type: 'line',
      data: arr.map(Number),
    };
  }

  return null;
}
