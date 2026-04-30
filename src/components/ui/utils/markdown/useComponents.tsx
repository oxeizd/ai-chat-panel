import React, { useMemo } from 'react';
import { ChartComponent } from './chartComponent/ChartComponent';
import { parseChartConfig, isValidChartConfig } from './chartParsing';

export const useMarkdownComponents = (chartContainerClass: string) => {
  return useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const codeText = String(children).replace(/\n$/, '');

        if (language === 'chart' && !inline) {
          try {
            const config = parseChartConfig(codeText);

            if (!isValidChartConfig(config)) {
              throw new Error('Missing data field');
            }

            return (
              <div className={chartContainerClass}>
                <ChartComponent config={config} />
              </div>
            );
          } catch (err) {
            console.error('Chart parsing error:', err);
            return (
              <div
                style={{ color: 'red', padding: '8px', border: '1px solid red', borderRadius: '4px', margin: '8px 0' }}
              >
                ❌ Ошибка парсинга графика: {err instanceof Error ? err.message : 'Неверный формат данных'}
              </div>
            );
          }
        }

        if (!inline) {
          return (
            <pre
              style={{
                overflowX: 'auto',
                margin: '8px 0',
                padding: '8px',
                background: 'rgba(0,0,0,0.05)',
                borderRadius: '4px',
              }}
            >
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
        }

        return (
          <code
            className={className}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.9em',
              background: 'rgba(0,0,0,0.06)',
              padding: '0.2em 0.4em',
              borderRadius: '3px',
            }}
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [chartContainerClass]
  );
};
