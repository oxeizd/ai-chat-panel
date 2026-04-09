export type VariableContext = Record<string, any>;

/**
 * Generates a random UUID v4.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Replaces all occurrences of {variable} in a string with values from context.
 * Supports special functions:
 *   {uuid4}         – generates a new UUID and stores it in context as 'uuid4'
 *   {uuid4:name}    – generates a new UUID and stores it in context as 'name'
 * Leaves the placeholder unchanged if the variable is not found.
 */
export const resolveString = (str: string, context: VariableContext): string => {
  return str.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmed = key.trim();

    // Всегда новый UUID, не сохраняется в контекст
    if (trimmed === '$uuid4') {
      return generateUUID();
    }

    // Условная генерация: если переменная уже есть в контексте – используем её
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

    // Обычная переменная
    const value = context[trimmed];
    return value !== undefined ? String(value) : match;
  });
};

/**
 * Recursively walks an object and resolves all string values containing variables.
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
