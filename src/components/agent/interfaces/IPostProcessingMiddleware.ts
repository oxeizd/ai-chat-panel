import { EndpointConfig } from 'types';
import { WorkflowContext } from '../core/ContextManager';
import { ProcessedResponse } from './IResponseHandler';

/**
 * Промежуточный обработчик (middleware), выполняемый после получения ответа.
 * Может изменять контекст, данные и т.д.
 */
export interface IPostProcessingMiddleware {
  name: string; // для отладки
  process(
    response: ProcessedResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext,
    requestBody?: any
  ): void | Promise<void>;
}