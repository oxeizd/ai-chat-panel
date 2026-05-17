import React, { useMemo } from 'react';
import { ChartComponent } from './chartComponent/ChartComponent';
import { parseChartConfig, isValidChartConfig } from './chartParsing';
import { CodeBlock } from 'components/ui/utils/markdown/CodeBlock';

export const useMarkdownComponents = (chartContainerClass: string) => {
  return useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const codeText = String(children).replace(/\n$/, '');

        // Графики
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

        // Формулы
        if (language === 'math') {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        // Блок кода без переносов и короткий → покажем как инлайн
        if (!inline && !codeText.includes('\n') && codeText.length < 100) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        // Обычный блок кода
        if (!inline) {
          return (
            <CodeBlock className={className} language={language}>
              {children}
            </CodeBlock>
          );
        }

        // Инлайн-код
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [chartContainerClass]
  );
};
