export interface DatasetConfig {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  borderWidth?: number;
  pointRadius?: number;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  tension?: number;
  fill?: boolean;
  type?: 'line' | 'bar';
  yAxisID?: string;
  stack?: string;
  pointHoverRadius?: number;
  pointHoverBackgroundColor?: string;
  borderDash?: number[];
  shadow?: boolean;
  gradient?: boolean;
}

export interface ChartData {
  datasets?: DatasetConfig[];
  labels?: string[] | Date[];
  title?: string;
  type?: 'line' | 'bar';
  xAxisType?: 'category' | 'time';
  xAxisTitle?: string;
  yAxisTitle?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  maintainAspectRatio?: boolean;
  height?: number | string;
  theme?: 'light' | 'dark' | 'auto';
  smooth?: boolean;
  areaOpacity?: number;
  showGrid?: boolean;
  data?: number[];
  borderColor?: string;
  backgroundColor?: string;
}
