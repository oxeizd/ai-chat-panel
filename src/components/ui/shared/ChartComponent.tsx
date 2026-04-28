import React, { useEffect, useRef, useMemo, useCallback } from 'react';
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
  // +++ Новые параметры для красоты
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
  // +++ Новые параметры для общего стиля
  theme?: 'light' | 'dark' | 'auto';
  smooth?: boolean;
  areaOpacity?: number;
  showGrid?: boolean;
  data?: number[];
  borderColor?: string;
  backgroundColor?: string;
}

// Современная палитра цветов
const modernColors = [
  { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', gradient: 'rgba(59, 130, 246, 0.4)' }, // blue
  { border: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', gradient: 'rgba(239, 68, 68, 0.4)' }, // red
  { border: '#10b981', background: 'rgba(16, 185, 129, 0.1)', gradient: 'rgba(16, 185, 129, 0.4)' }, // emerald
  { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', gradient: 'rgba(245, 158, 11, 0.4)' }, // amber
  { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', gradient: 'rgba(139, 92, 246, 0.4)' }, // violet
  { border: '#ec4899', background: 'rgba(236, 72, 153, 0.1)', gradient: 'rgba(236, 72, 153, 0.4)' }, // pink
  { border: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)', gradient: 'rgba(6, 182, 212, 0.4)' }, // cyan
  { border: '#84cc16', background: 'rgba(132, 204, 22, 0.1)', gradient: 'rgba(132, 204, 22, 0.4)' }, // lime
];

const generateModernColors = (index: number) => modernColors[index % modernColors.length];

// Создание градиента
const createGradient = (ctx: CanvasRenderingContext2D, color: string, areaOpacity: number = 0.3) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, color.replace('0.1', areaOpacity.toString()));
  gradient.addColorStop(0.5, color.replace('0.1', (areaOpacity * 0.5).toString()));
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  return gradient;
};

// Настройка тени
const setShadow = (ctx: CanvasRenderingContext2D, enabled: boolean = true) => {
  if (enabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
};

// Красивый tooltip
const customTooltip = {
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  titleColor: '#fff',
  titleFont: { size: 13, weight: 'bold' as const },   // 'bold' as const
  bodyColor: '#e5e7eb',
  bodyFont: { size: 12 },
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
};

// Генерация опций с красивыми настройками
const getBaseOptions = ({
  xAxisType,
  xAxisTitle,
  yAxisTitle,
  yAxisMin,
  yAxisMax,
  showLegend,
  showTooltip,
  title,
  maintainAspectRatio,
  datasets,
  showGrid = true,
  smooth = true,
  theme = 'auto',
}: any): ChartOptions<'line' | 'bar'> => {
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const titleColor = isDark ? '#f3f4f6' : '#111827';

  const yAxisIds: string[] = [];
  datasets?.forEach((ds: any) => {
    const id = ds.yAxisID || 'y';
    if (!yAxisIds.includes(id)) yAxisIds.push(id);
  });

  const scales: any = {};

  // X axis
  if (xAxisType === 'time') {
    scales.x = {
      type: 'time',
      title: { display: !!xAxisTitle, text: xAxisTitle || 'Дата', color: textColor },
      grid: { display: showGrid, color: gridColor, drawBorder: true, drawOnChartArea: true },
      ticks: { color: textColor, font: { size: 11 } },
      adapters: { date: { locale: 'ru' } },
      time: { unit: 'day', displayFormats: { day: 'dd MMM', week: 'dd MMM', month: 'MMM yyyy' }, tooltipFormat: 'dd MMM yyyy' },
    };
  } else {
    scales.x = {
      type: 'category',
      title: { display: !!xAxisTitle, text: xAxisTitle || 'Категории', color: textColor },
      grid: { display: false },
      ticks: { color: textColor, font: { size: 11 } },
    };
  }

  // Y axes
  yAxisIds.forEach((id, index) => {
    scales[id] = {
      type: 'linear',
      display: true,
      position: index === 0 ? 'left' : 'right',
      title: { display: index === 0 && !!yAxisTitle, text: index === 0 ? yAxisTitle : '', color: textColor },
      beginAtZero: yAxisMin === undefined,
      min: yAxisMin,
      max: yAxisMax,
      grid: { display: showGrid && index === 0, color: gridColor, drawBorder: true },
      ticks: { color: textColor, font: { size: 11 }, stepSize: undefined },
    };
  });

  return {
    responsive: true,
    maintainAspectRatio,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        align: 'center',
        labels: {
          color: textColor,
          font: { size: 12, weight: 'normal' },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        enabled: showTooltip,
        mode: 'index',
        intersect: false,
        ...customTooltip,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            label += context.parsed.y.toLocaleString('ru-RU');
            return label;
          },
        },
      },
      title: {
        display: !!title,
        text: title || '',
        color: titleColor,
        font: { size: 14, weight: 'bold' },
        padding: { top: 10, bottom: 20 },
      },
    },
    scales,
    interaction: { mode: 'index', intersect: false },
    elements: {
      line: { tension: smooth ? 0.4 : 0, borderWidth: 2.5, fill: false },
      point: { radius: 3, hoverRadius: 6, hitRadius: 10, borderWidth: 2 },
      bar: { borderRadius: 6, borderSkipped: false },
    },
    layout: { padding: { top: 10, left: 10, right: 10, bottom: 10 } },
  };
};

// Line Chart Component
const LineChartComponent: React.FC<{ config: ChartData }> = ({ config }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  } = config;

  const chartLabels = useMemo(() => {
    if (labels?.length) {
      return labels.map(label => {
        if (xAxisType === 'time') return new Date(label as string);
        return label;
      });
    }
    const maxLength = Math.max(...datasets.map(ds => ds.data.length), 0);
    return Array.from({ length: maxLength }, (_, i) => (i + 1).toString());
  }, [labels, datasets, xAxisType]);

  const chartDatasets = useMemo(() => {
    return datasets.map((dataset, index) => {
      const colors = generateModernColors(index);
      const borderColor = dataset.borderColor || colors.border;
      const fillColor = dataset.backgroundColor || colors.background;
      const gradientFill = dataset.gradient !== false;

      return {
        label: dataset.label,
        data: dataset.data,
        borderColor,
        backgroundColor: (ctx: any) => {
          if (!gradientFill || !ctx.chart.ctx) return fillColor;
          const gradient = createGradient(ctx.chart.ctx, fillColor, areaOpacity);
          return gradient;
        },
        borderWidth: dataset.borderWidth ?? 2.5,
        pointRadius: dataset.pointRadius ?? 3,
        pointHoverRadius: dataset.pointHoverRadius ?? 6,
        pointBackgroundColor: dataset.pointBackgroundColor || borderColor,
        pointBorderColor: dataset.pointBorderColor || '#fff',
        pointHoverBackgroundColor: dataset.pointHoverBackgroundColor || borderColor,
        pointHoverBorderColor: '#fff',
        tension: dataset.tension ?? (smooth ? 0.4 : 0),
        fill: dataset.fill ?? true,
        yAxisID: dataset.yAxisID || 'y',
        stack: dataset.stack,
        borderDash: dataset.borderDash,
      };
    });
  }, [datasets, smooth, areaOpacity]);

  const options = useMemo(() => getBaseOptions({
    xAxisType, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax,
    showLegend, showTooltip, title, maintainAspectRatio,
    datasets: chartDatasets, showGrid, smooth, theme,
  }), [xAxisType, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, showLegend, showTooltip, title, maintainAspectRatio, chartDatasets, showGrid, smooth, theme]);

  const chartData: ChartJSData<'line', number[], string | Date> = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  const handleResize = useCallback(() => {
    if (chartRef.current && containerRef.current) {
      chartRef.current.resize();
      chartRef.current.update();
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(handleResize, 100);
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => { clearTimeout(timeoutId); resizeObserver.disconnect(); };
  }, [handleResize]);

  if (!datasets?.length || !datasets[0]?.data?.length) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>📊 Нет данных для отображения</div>;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height, position: 'relative' }}>
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

// Bar Chart Component (аналогично с красивыми настройками)
const BarChartComponent: React.FC<{ config: ChartData }> = ({ config }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  } = config;

  const chartLabels = useMemo(() => {
    if (labels?.length) return labels;
    const maxLength = Math.max(...datasets.map(ds => ds.data.length), 0);
    return Array.from({ length: maxLength }, (_, i) => (i + 1).toString());
  }, [labels, datasets]);

  const chartDatasets = useMemo(() => {
    return datasets.map((dataset, index) => {
      const colors = generateModernColors(index);
      return {
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.borderColor || colors.border,
        backgroundColor: dataset.backgroundColor || colors.background,
        borderWidth: dataset.borderWidth ?? 1,
        borderRadius: 6,
        borderSkipped: false,
        yAxisID: dataset.yAxisID || 'y',
        stack: dataset.stack,
      };
    });
  }, [datasets]);

  const options = useMemo(() => getBaseOptions({
    xAxisType, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax,
    showLegend, showTooltip, title, maintainAspectRatio,
    datasets: chartDatasets, showGrid, theme,
  }), [xAxisType, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, showLegend, showTooltip, title, maintainAspectRatio, chartDatasets, showGrid, theme]);

  const chartData: ChartJSData<'bar', number[], string | Date> = {
    labels: chartLabels,
    datasets: chartDatasets,
  };

  const handleResize = useCallback(() => {
    if (chartRef.current && containerRef.current) chartRef.current.resize();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(handleResize, 100);
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => { clearTimeout(timeoutId); resizeObserver.disconnect(); };
  }, [handleResize]);

  if (!datasets?.length || !datasets[0]?.data?.length) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>📊 Нет данных для отображения</div>;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height }}>
      <Bar ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

// Главный компонент
export const ChartComponent: React.FC<{ config: ChartData }> = React.memo(({ config }) => {
  const normalizedConfig = useMemo((): ChartData => {
    if (config.data && !config.datasets) {
      const colors = generateModernColors(0);
      return {
        ...config,
        type: config.type || 'line',
        datasets: [{
          label: config.title || 'Значение',
          data: config.data,
          borderColor: config.borderColor || colors.border,
          backgroundColor: config.backgroundColor || colors.background,
          tension: 0.4,
          pointRadius: 4,
          fill: true,
        }],
      };
    }
    return config;
  }, [config]);

  const chartType = useMemo((): 'line' | 'bar' => {
    if (normalizedConfig.type) return normalizedConfig.type;
    if (normalizedConfig.datasets?.length) {
      const firstType = normalizedConfig.datasets[0]?.type;
      if (firstType) return firstType;
    }
    return 'line';
  }, [normalizedConfig]);

  if (chartType === 'bar') return <BarChartComponent config={normalizedConfig} />;
  return <LineChartComponent config={normalizedConfig} />;
});

ChartComponent.displayName = 'ChartComponent';