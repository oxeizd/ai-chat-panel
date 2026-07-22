export const preprocessMarkdown = (content: string): string => {
  if (!content) {
    return content;
  }
  // Заменяем экранированные \n на реальные переносы (везде)
  let processed = content.replace(/\\n/g, '\n');
  // Добавляем перенос перед закрывающими ```, если его нет
  processed = processed.replace(/([^\n])```/g, '$1\n```');
  return processed;
};
