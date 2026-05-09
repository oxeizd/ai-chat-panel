import { EndpointConfig } from '../../../shared/types';
import { WorkflowContext } from '../../contextManager';
import { ProcessedResponse } from '../handlers/response';
import { HistoryManager } from '../../historyManager';
import { parseFileFromResponse } from '../helpers/fileHandler';
import { saveToContext } from '../../../shared/utils/httpHelpers';

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

/**
 * Мидлвара: сохраняет историю (сообщение ассистента)
 */
export class HistoryMiddleware {
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

/**
 * Мидлвара: сохраняет поля ответа в контекст
 */
export class ContextSaveMiddleware {
  name = 'context-save';

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    const data = { ...resp.data, reply: resp.replyText };
    saveToContext(ep, ctx, data, ['reply', 'result', 'status']);
  }
}

/**
 * Мидлвара: извлекает файл из ответа и сохраняет в контекст
 */
export class FileExtractionMiddleware {
  name = 'file-extract';

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    const file = parseFileFromResponse(resp.data);
    if (file) {
      resp.data.fileAttachment = file;
      ctx.fileAttachment = file;
    }
  }
}
