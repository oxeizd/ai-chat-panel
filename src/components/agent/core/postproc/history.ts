import { PostProcessingMiddleware } from './types';
import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { ProcessedResponse } from '../response';
import { HistoryManager } from '../history';

/**
 * Мидлвара: добавляет ответ ассистента в историю.
 */
export class HistoryMiddleware implements PostProcessingMiddleware {
  name = 'history';

  constructor(private history: HistoryManager) {}

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    if (ep.preserveConversationHistory && resp.replyText) {
      this.history.addAssistantMessage(ep, ctx, resp.data, resp.replyText);
    }
  }
}
