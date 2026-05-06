import { EndpointConfig, StreamingConfig, TraceStep } from 'types';
import { EndpointExecutor } from './EndpointExecutor';

/**
 * Оркестратор последовательного выполнения цепочки эндпоинтов (workflow).
 */
export class WorkflowOrchestrator {
  constructor(private executor: EndpointExecutor) {}

  /**
   * Выполнить все шаги последовательно.
   * @param steps - массив шагов с эндпоинтами
   * @param initialContext - начальный дополнительный контекст (объединяется с текущим)
   * @param agentConfig - глобальная конфигурация агента
   * @param agentHeaders - глобальные заголовки
   * @param onTrace - колбэк трассировки
   * @param onChunk - колбэк для чанков (только для последнего шага со стримингом)
   * @param signal - AbortSignal
   * @returns результат последнего шага
   */
  async execute(
    steps: Array<{ endpoint: EndpointConfig }>,
    initialContext: Record<string, any>,
    agentConfig?: Record<string, any>,
    agentHeaders?: Record<string, string>,
    onTrace?: (step: TraceStep) => void,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<any> {
    let lastResponse: any = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isLast = i === steps.length - 1;
      // onChunk передаётся только для последнего шага, если он стриминговый
      const stepOnChunk =
        isLast &&
        (step.endpoint.streaming === true ||
          (step.endpoint.streaming as StreamingConfig)?.enabled === true)
          ? onChunk
          : undefined;

      lastResponse = await this.executor.execute(
        step.endpoint,
        initialContext,
        agentConfig,
        agentHeaders,
        onTrace,
        stepOnChunk,
        signal
      );
    }
    return lastResponse;
  }
}