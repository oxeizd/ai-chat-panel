const FENCE = '```';

export const preprocessMarkdown = (content: string): string => {
  if (!content) {
    return content;
  }

  // Для legacy/non-SSE ответа. В SSE после JSON.parse реальные LF уже есть.
  const source = content.replace(/\\n/g, '\n');
  let result = '';
  let cursor = 0;
  let codeBlockOpen = false;

  while (cursor < source.length) {
    const fenceIndex = source.indexOf(FENCE, cursor);

    if (fenceIndex === -1) {
      result += source.slice(cursor);
      break;
    }

    result += source.slice(cursor, fenceIndex);

    if (!codeBlockOpen) {
      // Opening fence.
      // Берём язык только до первого whitespace/LF/backtick.
      const afterFence = fenceIndex + FENCE.length;
      const languageMatch = source.slice(afterFence).match(/^([A-Za-z0-9_+-]*)/);
      const language = languageMatch?.[1] ?? '';
      const afterLanguage = afterFence + language.length;

      result += FENCE + language;
      codeBlockOpen = true;

      // Корректный opening: ```sql\n
      if (source.startsWith('\r\n', afterLanguage)) {
        result += '\n';
        cursor = afterLanguage + 2;
        continue;
      }

      if (source[afterLanguage] === '\n') {
        result += '\n';
        cursor = afterLanguage + 1;
        continue;
      }

      // Literal "\n" после языка: ```sql \n SELECT
      const literalNewline = source.slice(afterLanguage).match(/^[ \t]*\\n[ \t]*/);
      if (literalNewline) {
        result += '\n';
        cursor = afterLanguage + literalNewline[0].length;
        continue;
      }

      // Модель дала ```sql SELECT ... вместо ```sql\nSELECT ...
      const spaces = source.slice(afterLanguage).match(/^[ \t]+/);
      if (spaces) {
        result += '\n';
        cursor = afterLanguage + spaces[0].length;
        continue;
      }

      // Fence без языка: ```SELECT...
      // Тело блока начинается со следующего символа.
      result += '\n';
      cursor = afterLanguage;
      continue;
    }

    // Closing fence: гарантируем LF до и после него.
    if (result.length > 0 && !result.endsWith('\n')) {
      result += '\n';
    }

    result += FENCE;
    codeBlockOpen = false;

    const afterFence = fenceIndex + FENCE.length;

    if (source.startsWith('\r\n', afterFence)) {
      result += '\n';
      cursor = afterFence + 2;
      continue;
    }

    if (source[afterFence] === '\n') {
      result += '\n';
      cursor = afterFence + 1;
      continue;
    }

    // В исходном ответе ```За текстом. Делает ```\nЗа текстом.
    result += '\n';
    cursor = afterFence;
  }

  return result;
};
