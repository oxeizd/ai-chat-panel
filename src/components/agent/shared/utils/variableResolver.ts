export type VariableContext = Record<string, any>;

/** Генерация UUID v4 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Замена плейсхолдеров {variable} в строке значениями из контекста.
 * Специальные функции:
 *   {uuid4}         – генерация UUID (не сохраняется в контекст)
 *   {uuid4:name}    – генерация UUID с сохранением в контексте как name (если ещё нет)
 * Оставляет без изменений, если переменная не найдена.
 * @param str - строка с плейсхолдерами
 * @param context - контекст переменных
 * @returns строка с подставленными значениями
 */
export const resolveString = (str: string, context: VariableContext): string => {
  return str.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmed = key.trim();

    if (trimmed === '$uuid4') {
      return generateUUID();
    }

    if (trimmed.startsWith('$uuid4:')) {
      const varName = trimmed.substring(6).trim();
      if (varName) {
        if (context[varName] !== undefined) {
          return context[varName];
        }
        const uuid = generateUUID();
        context[varName] = uuid;
        return uuid;
      }
      return match;
    }

    const value = context[trimmed];
    return value !== undefined ? String(value) : match;
  });
};

/**
 * Рекурсивный обход объекта и разрешение всех строковых значений через resolveString.
 * @param obj - объект или массив
 * @param context - контекст переменных
 * @returns новый объект с разрешёнными значениями
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
