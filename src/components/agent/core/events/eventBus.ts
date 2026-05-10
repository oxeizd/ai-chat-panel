/**
 * Универсальная шина событий для потоковой передачи данных внутри агента.
 * Позволяет обрабатывать reasoning, tool_calls, изображения и т.д.
 * без необходимости прокидывать колбэки через все слои.
 *
 * @example
 *   const bus = new EventBus();
 *   const off = bus.on('chunk', (text) => console.log(text));
 *   bus.emit('chunk', 'Hello');
 *   off();
 */
export class EventBus {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  /**
   * Подписаться на событие.
   * @param event - имя события (например, 'chunk', 'reasoningChunk', 'toolCall')
   * @param handler - функция-обработчик
   * @returns функция для отписки
   */
  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Отписаться от события.
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Вызвать событие с произвольными аргументами.
   */
  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((h) => h(...args));
  }

  /**
   * Удалить все подписки (например, при сбросе сессии).
   */
  clear(): void {
    this.listeners.clear();
  }
}
