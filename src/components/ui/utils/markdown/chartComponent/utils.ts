import { useEffect, RefObject } from 'react';

// Константы
export const TEXT_COLOR_MUTED = '#94a3b8';
export const TOOLTIP_BG = 'rgba(15,23,42,0.85)';
export const TOOLTIP_BORDER = 'rgba(148,163,184,0.2)';
export const GRID_COLOR = 'rgba(148,163,184,0.08)';

// Генерация цветов
export const getColor = (idx: number) => {
  const hues = [248, 330, 142, 45, 263, 186, 27, 292];
  const hue = hues[idx % hues.length];
  return {
    border: `hsl(${hue}, 75%, 65%)`,
    background: `hsla(${hue}, 75%, 65%, 0.15)`,
    gradient: `hsla(${hue}, 75%, 65%, 0.5)`,
  };
};

// Форматирование чисел
export const formatNumber = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }
  return value;
};

// Градиент
export const createGradient = (ctx: CanvasRenderingContext2D, color: string, opacity = 0.3) => {
  const chartArea = (ctx as any).chart?.chartArea;
  if (!chartArea) {
    return color;
  }
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.6, color.replace(/[\d.]+\)$/, `${opacity * 0.3})`));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  return gradient;
};

// Хук для ресайза
export const useChartResize = (containerRef: RefObject<HTMLDivElement | null>, chartRef: RefObject<any>) => {
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const observer = new ResizeObserver(() => chartRef.current?.resize?.());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, chartRef]); // ← добавили chartRef в зависимости
};
