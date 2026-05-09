import { EndpointConfig, TraceStep } from '../shared/types';
import { EndpointExecutor } from './executor';

/**
 * Оркестратор цепочки эндпоинтов (workflow).
 * Последовательно выполняет шаги, передавая контекст от одного к другому.
 */
export class WorkflowOrchestrator {
  constructor(private executor: EndpointExecutor) {}

  /**
   * Выполнить все шаги.
   * @param steps - массив шагов с эндпоинтами
   * @param initialCtx - дополнительный начальный контекст
   * @param agentConfig - глобальная конфигурация
   * @param agentHeaders - глобальные заголовки
   * @param onTrace - трассировка
   * @param onChunk - для совместимости (фактически через шину)
   * @param onReasoningChunk - для совместимости
   * @param signal - AbortSignal
   * @returns результат последнего шага
   */
  async execute(
    steps: Array<{ endpoint: EndpointConfig }>,
    initialCtx: Record<string, any>,
    agentConfig?: Record<string, any>,
    agentHeaders?: Record<string, string>,
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<any> {
    let last: any = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      last = await this.executor.execute(step.endpoint, initialCtx, agentConfig, agentHeaders, onTrace, signal);
    }
    return last;
  }
}
