// agents/VariableResolver.ts
export type VariableContext = Record<string, any>;

/**
 * Заменяет в строке все вхождения вида {variable} на значения из контекста.
 * Если переменная не найдена, оставляет как есть.
 */
export const resolveString = (str: string, context: VariableContext): string => {
  return str.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = context[key.trim()];
    return value !== undefined ? String(value) : match;
  });
};

/**
 * Рекурсивно обходит объект и заменяет все строковые значения с переменными.
 */
export const resolveObject = <T extends Record<string, any>>(obj: T, context: VariableContext): T => {
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = resolveString(value, context);
    } else if (value && typeof value === 'object') {
      result[key] = resolveObject(value, context);
    } else {
      result[key] = value;
    }
  }
  return result;
};