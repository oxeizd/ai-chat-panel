// agents/VariableResolver.ts
export type VariableContext = Record<string, any>;

/**
 * Replaces all occurrences of {variable} in a string with values from context.
 * Leaves the placeholder unchanged if the variable is not found.
 */
export const resolveString = (str: string, context: VariableContext): string => {
  return str.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = context[key.trim()];
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
