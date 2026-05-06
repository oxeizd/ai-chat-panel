/**
 * Контекст выполнения агента. Хранит переменные и историю сообщений.
 */
export interface WorkflowContext extends Record<string, any> {
    messages?: any[];
  }
  
  /**
   * Управление контекстом сессии агента.
   * Поддерживает точечное обновление и полную замену.
   */
  export class ContextManager {
    private _context: WorkflowContext = {};
  
    /** Возвращает текущий контекст (только для чтения) */
    get context(): WorkflowContext {
      return this._context;
    }
  
    /** Частичное обновление контекста */
    update(updates: Partial<WorkflowContext>): void {
      Object.assign(this._context, updates);
    }
  
    /** Установка одного значения по ключу */
    set(key: string, value: any): void {
      this._context[key] = value;
    }
  
    /** Полная замена контекста */
    replace(newContext: WorkflowContext): void {
      this._context = newContext;
    }
  
    /** Сброс контекста до пустого */
    reset(): void {
      this._context = {};
    }
  }