export const mergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => ({
  ...base,
  ...override,
});

export const extractValueByPath = (obj: any, path: string): any => {
  if (!path) {
    return obj;
  }
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    if (Array.isArray(acc) && /^\d+$/.test(key)) {
      return acc[parseInt(key, 10)];
    }
    return acc[key];
  }, obj);
};
