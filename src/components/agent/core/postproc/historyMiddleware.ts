import { PostProcessingMiddleware } from './types';
import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { ProcessedResponse } from '../response';
import { HistoryManager } from '../history';

export class HistoryMiddleware implements PostProcessingMiddleware {
  name = 'history';

  constructor(private history: HistoryManager) {}

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    if (resp.historySynced) {
      return;
    }

    const ch = ep.conversationHistory;
    const enabled = ch === true ? true : ch && typeof ch === 'object' ? ch.enabled : false;

    if (enabled && resp.replyText) {
      this.history.addAssistantMessage(ep, ctx, resp.data, resp.replyText);
    }
  }
}
