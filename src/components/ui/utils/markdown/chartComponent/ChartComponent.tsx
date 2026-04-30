import React, { useEffect, useRef, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
  ChartData as ChartJSData,
  ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ========== Типы ==========
export interface DatasetConfig {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  borderWidth?: number;
  pointRadius?: number;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  // Added hover border color
  pointHoverBorderColor?: string;
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
  overlayGradient?: boolean;
  overlayGradientCSS?: string;
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
  overlayGradientStyle?: string;
}

// ========== Константы ==========
const MODERN_COLORS = [
  { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)', gradient: 'rgba(59, 130, 246, 0.6)' },
  { border: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', gradient: 'rgba(239, 68, 68, 0.6)' },
  { border: '#10b981', background: 'rgba(16, 185, 129, 0.12)', gradient: 'rgba(16, 185, 129, 0.6)' },
  { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', gradient: 'rgba(245, 158, 11, 0.6)' },
  { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.12)', gradient: 'rgba(139, 92, 246, 0.6)' },
  { border: '#ec4899', background: 'rgba(236, 72, 153, 0.12)', gradient: 'rgba(236, 72, 153, 0.6)' },
  { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.12)', gradient: 'rgba(6, 182, 212, 0.6)' },
  { border: '#84cc16', background: 'rgba(132, 204, 22, 0.12)', gradient: 'rgba(132, 204, 22, 0.6)' },
];

// ========== Хук для ResizeObserver (упрощённый) ==========
const useChartResize = (containerRef: React.RefObject<HTMLDivElement>, chartRef: React.RefObject<any>) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const handleResize = () => {
      const chart = chartRef.current;
      if (chart?.resize) {
        chart.resize();
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    handleResize();
    return () => observer.disconnect();
  }, [containerRef, chartRef]);
};

// ========== Вспомогательные функции ==========
const generateColor = (idx: number) => MODERN_COLORS[idx % MODERN_COLORS.length];

const clampAlpha = (s: string, alpha: number) => {
  if (!s.includes('rgb')) {
    return s;
  }
  const nums = s.replace(/rgba?\(|\)|\s/g, '').split(',');
  const [r, g, b] = nums;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const createGradient = (ctx: CanvasRenderingContext2D, color: string, areaOpacity = 0.3) => {
  const chart = (ctx as any).chart;
  const chartArea = chart?.chartArea;
  if (!chartArea) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, clampAlpha(color, areaOpacity));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    return gradient;
  }

  const { top, bottom } = chartArea;
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, clampAlpha(color, areaOpacity));
  gradient.addColorStop(0.5, clampAlpha(color, Math.max(areaOpacity * 0.4, 0.05)));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  return gradient;
};

// Кастомизированный tooltip с темой
const buildTooltipConfig = (showTooltip: boolean, isDark: boolean) => ({
  enabled: showTooltip,
  mode: 'index' as const,
  intersect: false,
  backgroundColor: isDark ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
  titleColor: isDark ? '#fff' : '#0b1220',
  titleFont: { size: 13, weight: 600 as unknown as number },
  bodyColor: isDark ? '#e5e7eb' : '#374151',
  bodyFont: { size: 12 },
  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 6,
  callbacks: {
    label: (context: any) => {
      let label = context.dataset.label || '';
      if (label) {
        label += ': ';
      }
      const locale = navigator.language || 'en';
      const value = context.parsed?.y ?? context.parsed;
      return label + (typeof value === 'number' ? value.toLocaleString(locale) : String(value));
    },
  },
});

// ========== LineChartComponent ==========
const LineChartComponent: React.FC<{ config: ChartData }> = React.memo(({ config }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useChartResize(containerRef, chartRef);

  const {
    datasets = [],
    labels,
    title,
    xAxisType = 'category',
    xAxisTitle,
    yAxisTitle,
    yAxisMin,
    yAxisMax,
    showLegend = true,
    showTooltip = true,
    maintainAspectRatio = false,
    height = '350px',
    theme = 'auto',
    smooth = true,
    showGrid = true,
    areaOpacity = 0.3,
    overlayGradientStyle,
  } = config;

  const chartLabels = useMemo(() => {
    if (labels?.length) {
      return labels.map((label) => (xAxisType === 'time' ? new Date(label as string) : label));
    }
    const maxLen = Math.max(...datasets.map((ds) => ds.data.length), 0);
    return Array.from({ length: maxLen }, (_, i) => (i + 1).toString());
  }, [labels, datasets, xAxisType]);

  const chartDatasets = useMemo(
    () =>
      datasets.map((ds, idx) => {
        const c = generateColor(idx);
        const borderColor = ds.borderColor || c.border;
        const fillColor = ds.backgroundColor || c.gradient || c.background;
        const useGradient = ds.gradient !== false;
        return {
          label: ds.label,
          data: ds.data,
          borderColor,
          backgroundColor: useGradient
            ? (ctx: any) => createGradient(ctx.chart.ctx, fillColor, areaOpacity)
            : fillColor,
          borderWidth: ds.borderWidth ?? 3,
          pointRadius: ds.pointRadius ?? 4,
          pointHoverRadius: ds.pointHoverRadius ?? 7,
          pointBackgroundColor: ds.pointBackgroundColor || borderColor,
          pointBorderColor: ds.pointBorderColor || (theme === 'dark' ? '#08101a' : '#fff'),
          pointHoverBackgroundColor: ds.pointHoverBackgroundColor || '#fff',
          pointHoverBorderColor: ds.pointHoverBorderColor || borderColor,
          tension: ds.tension ?? (smooth ? 0.42 : 0),
          fill: ds.fill ?? true,
          yAxisID: ds.yAxisID || 'y',
          stack: ds.stack,
          borderDash: ds.borderDash,
        };
      }),
    [datasets, smooth, areaOpacity, theme]
  );

  const optionsRaw = useMemo(() => {
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
    const textColor = isDark ? '#e6edf3' : '#0f172a';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';

    const scales: any = {
      x: {
        type: xAxisType === 'time' ? 'time' : 'category',
        title: xAxisTitle ? { display: true, text: xAxisTitle, color: textColor } : undefined,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor },
      },
      y: {
        type: 'linear',
        title: yAxisTitle ? { display: true, text: yAxisTitle, color: textColor } : undefined,
        min: yAxisMin,
        max: yAxisMax,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor },
      },
    };

    return {
      responsive: true,
      maintainAspectRatio,
      plugins: {
        legend: { display: showLegend, labels: { color: textColor } },
        tooltip: buildTooltipConfig(showTooltip, isDark),
        title: { display: !!title, text: title, color: textColor, font: { size: 14, weight: 600 } },
      },
      scales,
      interaction: { mode: 'index', intersect: false },
      elements: { line: { tension: smooth ? 0.42 : 0 }, point: { radius: 4, hoverRadius: 7 } },
    };
  }, [
    xAxisType,
    xAxisTitle,
    yAxisTitle,
    yAxisMin,
    yAxisMax,
    showLegend,
    showTooltip,
    title,
    maintainAspectRatio,
    theme,
    smooth,
    showGrid,
  ]);

  const options = optionsRaw as unknown as ChartOptions<'line'>;

  const chartData: ChartJSData<'line', number[], string | Date> = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  if (!datasets.length || !datasets[0]?.data.length) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Нет данных для отображения</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {overlayGradientStyle && (
        <div
          style={{
            position: 'absolute',
            left: 3,
            right: -3,
            top: 2.48,
            bottom: -1,
            pointerEvents: 'none',
            background: overlayGradientStyle,
            opacity: 0.5,
            borderRadius: 6,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
});
LineChartComponent.displayName = 'LineChartComponent';

// ========== BarChartComponent ==========
const BarChartComponent: React.FC<{ config: ChartData }> = React.memo(({ config }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useChartResize(containerRef, chartRef);

  const {
    datasets = [],
    labels,
    title,
    xAxisType = 'category',
    xAxisTitle,
    yAxisTitle,
    yAxisMin,
    yAxisMax,
    showLegend = true,
    showTooltip = true,
    maintainAspectRatio = false,
    height = '350px',
    theme = 'auto',
    showGrid = true,
    overlayGradientStyle,
  } = config;

  const chartLabels = useMemo(() => {
    if (labels?.length) {
      return labels;
    }
    const maxLen = Math.max(...datasets.map((ds) => ds.data.length), 0);
    return Array.from({ length: maxLen }, (_, i) => (i + 1).toString());
  }, [labels, datasets]);

  const chartDatasets = useMemo(
    () =>
      datasets.map((ds, idx) => {
        const c = generateColor(idx);
        return {
          label: ds.label,
          data: ds.data,
          borderColor: ds.borderColor || c.border,
          backgroundColor: ds.backgroundColor || c.background,
          borderWidth: ds.borderWidth ?? 1,
          borderRadius: 8,
          borderSkipped: false,
          yAxisID: ds.yAxisID || 'y',
          stack: ds.stack,
        };
      }),
    [datasets]
  );

  const optionsRaw = useMemo(() => {
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
    const textColor = isDark ? '#e6edf3' : '#0f172a';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';

    const scales: any = {
      x: {
        type: xAxisType === 'time' ? 'time' : 'category',
        title: xAxisTitle ? { display: true, text: xAxisTitle, color: textColor } : undefined,
        grid: { display: false },
        ticks: { color: textColor },
      },
      y: {
        type: 'linear',
        title: yAxisTitle ? { display: true, text: yAxisTitle, color: textColor } : undefined,
        min: yAxisMin,
        max: yAxisMax,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor },
      },
    };

    return {
      responsive: true,
      maintainAspectRatio,
      plugins: {
        legend: { display: showLegend, labels: { color: textColor } },
        tooltip: buildTooltipConfig(showTooltip, isDark),
        title: { display: !!title, text: title, color: textColor, font: { size: 14, weight: 600 } },
      },
      scales,
      interaction: { mode: 'index', intersect: false },
    };
  }, [
    xAxisType,
    xAxisTitle,
    yAxisTitle,
    yAxisMin,
    yAxisMax,
    showLegend,
    showTooltip,
    title,
    maintainAspectRatio,
    theme,
    showGrid,
  ]);

  const options = optionsRaw as unknown as ChartOptions<'bar'>;

  const chartData: ChartJSData<'bar', number[], string | Date> = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  if (!datasets.length || !datasets[0]?.data.length) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Нет данных для отображения</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {overlayGradientStyle && (
        <div
          style={{
            position: 'absolute',
            left: 3,
            right: -3,
            top: 2.48,
            bottom: -1,
            pointerEvents: 'none',
            background: overlayGradientStyle,
            opacity: 0.5,
            borderRadius: 6,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <Bar ref={chartRef} data={chartData} options={options} />
    </div>
  );
});
BarChartComponent.displayName = 'BarChartComponent';

// ========== Главный компонент ChartComponent ==========
export const ChartComponent: React.FC<{ config: ChartData }> = React.memo(({ config }) => {
  const normalizedConfig = useMemo<ChartData>(() => {
    if (config.data && !config.datasets) {
      const c = generateColor(0);
      return {
        ...config,
        type: config.type || 'line',
        datasets: [
          {
            label: config.title || 'Значение',
            data: config.data,
            borderColor: config.borderColor || c.border,
            backgroundColor: config.backgroundColor || c.background,
            tension: 0.4,
            pointRadius: 4,
            fill: true,
          },
        ],
      };
    }
    return config;
  }, [config]);

  const chartType = normalizedConfig.type || normalizedConfig.datasets?.[0]?.type || 'line';

  if (chartType === 'bar') {
    return <BarChartComponent config={normalizedConfig} />;
  }
  return <LineChartComponent config={normalizedConfig} />;
});

ChartComponent.displayName = 'ChartComponent';
