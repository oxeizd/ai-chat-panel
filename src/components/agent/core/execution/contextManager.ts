/**
 * Контекст выполнения агента – хранит переменные и массив сообщений.
 */
export interface WorkflowContext extends Record<string, any> {
  messages?: any[];
}

/**
 * Управление контекстом сессии.
 * Поддерживает точечное обновление, замену и сброс.
 */
export class ContextManager {
  private ctx: WorkflowContext = {};

  get context(): WorkflowContext {
    return this.ctx;
  }

  /** Частичное обновление контекста */
  update(patch: Partial<WorkflowContext>) {
    Object.assign(this.ctx, patch);
  }

  /** Установка одного значения */
  set(key: string, value: any) {
    this.ctx[key] = value;
  }

  /** Полная замена контекста */
  replace(newCtx: WorkflowContext) {
    this.ctx = newCtx;
  }

  /** Сброс контекста до пустого */
  reset() {
    this.ctx = {};
  }
}
