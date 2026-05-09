import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { ProcessedResponse } from '../response';

/**
 * Интерфейс мидлвары постобработки ответа.
 */
export interface PostProcessingMiddleware {
  name: string;
  process(
    response: ProcessedResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    requestBody?: any
  ): void | Promise<void>;
}
