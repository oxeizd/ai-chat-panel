import { EndpointConfig } from '../shared/types';
import { WorkflowContext } from './context';
import { addUserMessageToHistory, addAssistantMessageToHistory } from '../shared/utils/historyManager';

/**
 * Менеджер истории диалога.
 */
export class HistoryManager {
  /**
   * Добавить сообщение пользователя в историю (вызывается до отправки запроса).
   */
  addUserMessage(ep: EndpointConfig, ctx: WorkflowContext, body: any) {
    addUserMessageToHistory(ep, ctx, body);
  }

  /**
   * Добавить сообщение ассистента в историю (после получения ответа).
   */
  addAssistantMessage(ep: EndpointConfig, ctx: WorkflowContext, data: any, reply?: string, skipIfSynced = false) {
    addAssistantMessageToHistory(ep, ctx, data, reply, skipIfSynced);
  }
}
