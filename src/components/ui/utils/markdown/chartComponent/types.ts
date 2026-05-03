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
  stack?: string;
  pointHoverRadius?: number;
  borderDash?: number[];
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
  height?: number | string;
  smooth?: boolean;
  areaOpacity?: number;
  showGrid?: boolean;
  data?: number[];
  borderColor?: string;
  backgroundColor?: string;
}
