/**
 * Объединение двух объектов (поверхностное).
 * @param base - базовый объект
 * @param override - объект с переопределяющими полями
 * @returns новый объект
 */
export const mergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => ({
    ...base,
    ...override,
  });
  
  /**
   * Извлечение значения из объекта по пути, заданному строкой с точками и индексами.
   * @param obj - исходный объект
   * @param path - путь, например "choices.0.delta.content" или "data[0].name"
   * @returns значение или undefined
   */
  export const extractValueByPath = (obj: any, path: string): any => {
    if (!path) return obj;
    // Поддержка синтаксиса с квадратными скобками: data[0] -> data.0
    const normalized = path.replace(/\[(\d+)\]/g, '.$1');
    return normalized.split('.').reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      // Если acc массив и ключ число, обращаемся по индексу
      if (Array.isArray(acc) && /^\d+$/.test(key)) {
        return acc[parseInt(key, 10)];
      }
      return acc[key];
    }, obj);
  };