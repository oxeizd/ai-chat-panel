import { IPostProcessingMiddleware } from '../../interfaces/IPostProcessingMiddleware';
import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../core/ContextManager';
import { ProcessedResponse } from '../../interfaces/IResponseHandler';
import { HistoryManager } from '../../core/HistoryManager';

/**
 * Middleware для добавления сообщения ассистента в историю после ответа.
 */
export class HistoryMiddleware implements IPostProcessingMiddleware {
  name = 'HistoryMiddleware';
  private historyManager: HistoryManager;

  constructor(historyManager: HistoryManager) {
    this.historyManager = historyManager;
  }

  process(
    response: ProcessedResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext
  ): void {
    if (!endpoint.preserveConversationHistory || !response.replyText) return;
    // Добавляем сообщение ассистента (пользователь уже добавлен до запроса)
    this.historyManager.addAssistantMessage(endpoint, context, response.data, response.replyText);
  }
}