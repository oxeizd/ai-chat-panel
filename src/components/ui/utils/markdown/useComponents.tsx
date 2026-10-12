import React, { useMemo } from 'react';
import { ChartComponent } from './chartComponent/ChartComponent';
import { parseChartConfig, isValidChartConfig } from './chartParsing';
import { CodeBlock } from 'components/ui/utils/markdown/CodeBlock';
import { extractText } from 'components/ui/utils/markdown/chartComponent/utils';

export const useMarkdownComponents = (chartContainerClass: string) => {
  return useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const match = /language-([\w-]+)/.exec(className || '');
        const language = (match ? match[1] : '').toLowerCase();

        const codeText = extractText(children).replace(/\n$/, '');

        if (inline) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        const isLikelyInline = !language && codeText.length < 80 && !codeText.includes('\n');
        if (isLikelyInline) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        // Графики
        if (language === 'chart') {
          try {
            const config = parseChartConfig(codeText);

            if (!isValidChartConfig(config)) {
              throw new Error('Отсутствует обязательное поле: ожидается "data" или "datasets".');
            }

            return (
              <div className={chartContainerClass}>
                <ChartComponent config={config} />
              </div>
            );
          } catch (err) {
            // Логируем сырой текст, чтобы видеть, что реально пришло от модели

            console.error('Chart parsing error. Raw codeText:', codeText);

            console.error(err);

            return (
              <div
                style={{
                  color: '#ef4444',
                  padding: '8px 10px',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  margin: '8px 0',
                  background: 'rgba(239, 68, 68, 0.08)',
                  fontSize: '0.85rem',
                }}
              >
                <div>❌ Ошибка парсинга графика: {err instanceof Error ? err.message : 'Неверный формат данных'}</div>

                <details style={{ marginTop: 6 }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '0.75rem',
                      userSelect: 'none',
                    }}
                  >
                    Показать исходные данные
                  </summary>
                  <pre
                    style={{
                      marginTop: 6,
                      padding: '0.5rem',
                      background: 'rgb(69 72 85 / 20%)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 240,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                    }}
                  >
                    {codeText}
                  </pre>
                </details>
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
