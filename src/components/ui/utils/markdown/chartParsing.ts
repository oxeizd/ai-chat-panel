import { ChartData } from './chartComponent/types';

export const parseChartConfig = (codeText: string): ChartData => {
  if (codeText.trim().startsWith('{')) {
    return JSON.parse(codeText);
  }

  const parsed = JSON.parse(codeText);
  return Array.isArray(parsed) ? { data: parsed } : parsed;
};

export const isValidChartConfig = (config: ChartData): boolean => {
  return !!(config.datasets || config.data);
};
