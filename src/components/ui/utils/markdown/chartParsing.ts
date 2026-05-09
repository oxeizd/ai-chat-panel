import { ChartData } from './chartComponent/types';

export const parseChartConfig = (codeText: string): ChartData => {
  const parsed = JSON.parse(codeText);
  return Array.isArray(parsed) ? { data: parsed } : parsed;
};

export const isValidChartConfig = (config: ChartData): boolean => {
  return !!(config.datasets || config.data);
};
