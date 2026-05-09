import { PostProcessingMiddleware } from './types';
import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { ProcessedResponse } from '../response';
import { saveToContext } from 'components/agent/shared/utils/httpHelpers';

/**
 * Мидлвара: сохраняет поля ответа в контекст.
 */
export class ContextSaveMiddleware implements PostProcessingMiddleware {
  name = 'context-save';

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    const data = { ...resp.data, reply: resp.replyText };
    saveToContext(ep, ctx, data, ['reply', 'result', 'status']);
  }
}
