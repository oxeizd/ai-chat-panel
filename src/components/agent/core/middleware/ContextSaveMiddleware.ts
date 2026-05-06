import { IPostProcessingMiddleware } from '../../interfaces/IPostProcessingMiddleware';
import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../core/ContextManager';
import { ProcessedResponse } from '../../interfaces/IResponseHandler';
import { saveToContext } from '../../utils/httpHelpers';

/**
 * Middleware, сохраняющий поля ответа в контекст согласно saveToContext.
 */
export class ContextSaveMiddleware implements IPostProcessingMiddleware {
  name = 'ContextSaveMiddleware';

  process(
    response: ProcessedResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext
  ): void {
    const data = { ...response.data, reply: response.replyText };
    saveToContext(endpoint, context, data, ['reply', 'result', 'status']);
  }
}