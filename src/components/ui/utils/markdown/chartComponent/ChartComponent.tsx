import React, { useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
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

import { ChartData, DatasetConfig } from './types';
import {
  TEXT_COLOR_MUTED,
  TOOLTIP_BG,
  TOOLTIP_BORDER,
  GRID_COLOR,
  getColor,
  formatNumber,
  createGradient,
  useChartResize,
} from './utils';

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

const ChartRenderer: React.FC<{ config: ChartData; chartType: 'line' | 'bar' }> = React.memo(
  ({ config, chartType }) => {
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
      showLegend = false,
      showTooltip = true,
      height = 400,
      smooth = true,
      showGrid = true,
      areaOpacity = 0.25,
    } = config;

    const chartLabels = useMemo(
      () =>
        labels?.length
          ? labels.map((l) => (xAxisType === 'time' ? new Date(l as string) : l))
          : Array.from({ length: Math.max(...datasets.map((ds) => ds.data.length), 0) }, (_, i) => (i + 1).toString()),
      [labels, datasets, xAxisType]
    );

    const chartDatasets = useMemo(
      () =>
        datasets.map((ds: DatasetConfig, idx: number) => {
          const c = getColor(idx);
          const border = ds.borderColor || c.border;
          const gradientColor = ds.borderColor?.startsWith('#')
            ? `rgba(${parseInt(ds.borderColor.slice(1, 3), 16)},${parseInt(ds.borderColor.slice(3, 5), 16)},${parseInt(ds.borderColor.slice(5, 7), 16)},0.5)`
            : c.gradient;

          const baseConfig = {
            label: ds.label,
            data: ds.data,
            borderColor: border,
            yAxisID: 'y',
            stack: ds.stack,
          };

          if (chartType === 'line' || ds.type === 'line') {
            return {
              ...baseConfig,
              backgroundColor:
                ds.gradient !== false
                  ? (ctx: any) => createGradient(ctx.chart.ctx, gradientColor, areaOpacity)
                  : ds.fill !== false
                    ? c.background
                    : 'transparent',
              borderWidth: ds.borderWidth ?? 2.5,
              pointRadius: ds.pointRadius ?? 0,
              pointHoverRadius: ds.pointHoverRadius ?? 6,
              pointBackgroundColor: ds.pointBackgroundColor || '#fff',
              pointBorderColor: ds.pointBorderColor || border,
              pointBorderWidth: 2,
              tension: ds.tension ?? (smooth ? 0.45 : 0),
              fill: ds.fill ?? true,
              borderDash: ds.borderDash,
              type: 'line',
            };
          }

          return {
            ...baseConfig,
            backgroundColor: ds.backgroundColor || c.background,
            borderWidth: ds.borderWidth ?? 0,
            borderRadius: 8,
            type: 'bar',
          };
        }),
      [datasets, smooth, areaOpacity, chartType]
    );

    const options = useMemo(
      (): ChartOptions<any> => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: showLegend,
            position: 'top' as const,
            labels: { color: TEXT_COLOR_MUTED, usePointStyle: true, font: { size: 12 } },
          },
          tooltip: {
            enabled: showTooltip,
            mode: 'index',
            intersect: false,
            backgroundColor: TOOLTIP_BG,
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: TOOLTIP_BORDER,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
          },
          title: title
            ? {
                display: true,
                text: title,
                color: '#f8fafc',
                font: { size: 18, weight: 'bold' as const },
                padding: { bottom: 24 },
              }
            : undefined,
        },
        scales: {
          x: {
            type: xAxisType === 'time' ? 'time' : 'category',
            title: xAxisTitle
              ? { display: true, text: xAxisTitle, color: TEXT_COLOR_MUTED, font: { size: 11 } }
              : undefined,
            grid: { display: false, color: GRID_COLOR },
            ticks: { color: TEXT_COLOR_MUTED, font: { size: 11 } },
          },
          y: {
            position: 'left',
            title: yAxisTitle
              ? { display: true, text: yAxisTitle, color: TEXT_COLOR_MUTED, font: { size: 11 } }
              : undefined,
            min: yAxisMin,
            max: yAxisMax,
            grid: { display: showGrid, color: GRID_COLOR },
            ticks: { color: TEXT_COLOR_MUTED, font: { size: 11 }, callback: formatNumber },
          },
        },
      }),
      [showLegend, showTooltip, title, xAxisType, xAxisTitle, yAxisTitle, yAxisMin, yAxisMax, showGrid]
    );

    const chartData: ChartJSData<any> = { labels: chartLabels, datasets: chartDatasets };

    if (!datasets.length || !datasets[0]?.data.length) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: TEXT_COLOR_MUTED }}>Нет данных для отображения</div>
      );
    }

    return (
      <div ref={containerRef} style={{ width: '100%', height: typeof height === 'number' ? height : height }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    );
  }
);

ChartRenderer.displayName = 'ChartRenderer';

export const ChartComponent: React.FC<{ config: ChartData }> = React.memo(({ config }) => {
  const normalized = useMemo<ChartData>(() => {
    if (config.data && !config.datasets) {
      const c = getColor(0);
      return {
        ...config,
        type: config.type || 'line',
        datasets: [
          {
            label: config.title || 'Значение',
            data: config.data,
            borderColor: config.borderColor || c.border,
            backgroundColor: config.backgroundColor || c.background,
            tension: 0.45,
            pointRadius: 0,
            fill: true,
          },
        ],
      };
    }
    return config;
  }, [config]);

  return <ChartRenderer config={normalized} chartType={normalized.type === 'bar' ? 'bar' : 'line'} />;
});

ChartComponent.displayName = 'ChartComponent';
