import { ResolvedEndpointConfig } from '../../config/types';
import { WorkflowContext } from '../../execution/contextManager';
import { ProcessedResponse } from '../handlers/response';
import { HistoryManager } from '../../execution/historyManager';
import { parseFileFromResponse } from '../helpers/fileHandler';

export interface PostProcessingMiddleware {
  name: string;
  process(
    response: ProcessedResponse,
    endpoint: ResolvedEndpointConfig,
    context: WorkflowContext,
    requestBody?: any
  ): void | Promise<void>;
}

export class HistoryMiddleware implements PostProcessingMiddleware {
  name = 'history';
  constructor(private history: HistoryManager) {}

  process(resp: ProcessedResponse, endpoint: ResolvedEndpointConfig, ctx: WorkflowContext) {
    if (resp.historySynced) {
      return;
    }
    if (endpoint.conversationHistory && resp.replyText) {
      this.history.addAssistantMessage(endpoint, ctx, resp.data, resp.replyText);
    }
  }
}

export class ContextSaveMiddleware implements PostProcessingMiddleware {
  name = 'context-save';
  process(resp: ProcessedResponse, endpoint: ResolvedEndpointConfig, ctx: WorkflowContext) {
    const data = { ...resp.data, reply: resp.replyText };
    const { saveToContext } = endpoint;
  
    if (!saveToContext || saveToContext.length === 0) return;
  
    for (const key of saveToContext) {
      if (data[key] !== undefined && key !== 'messages') {
        ctx[key] = data[key];
      }
    }
  }
}

export class FileExtractionMiddleware implements PostProcessingMiddleware {
  name = 'file-extract';
  process(resp: ProcessedResponse, _endpoint: ResolvedEndpointConfig, ctx: WorkflowContext) {
    const file = parseFileFromResponse(resp.data);
    if (file) {
      resp.data.fileAttachment = file;
      ctx.fileAttachment = file;
    }
  }
}