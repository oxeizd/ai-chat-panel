import { EndpointConfig } from 'types';
import { WorkflowContext } from './ContextManager';
import { addUserMessageToHistory, addAssistantMessageToHistory } from '../utils/historyManager';

/**
 * Менеджер истории сообщений.
 * Использует существующие утилиты для добавления сообщений.
 */
export class HistoryManager {
  /**
   * Добавляет сообщение пользователя в историю контекста.
   * @param endpoint - конфигурация эндпоинта
   * @param context - мутабельный контекст
   * @param mergedBody - тело запроса
   */
  addUserMessage(endpoint: EndpointConfig, context: WorkflowContext, mergedBody: any): void {
    addUserMessageToHistory(endpoint, context, mergedBody);
  }

  /**
   * Добавляет сообщение ассистента в историю контекста.
   * @param endpoint - конфигурация эндпоинта
   * @param context - мутабельный контекст
   * @param responseData - данные ответа
   * @param replyText - текст ответа
   * @param skipIfAlreadySynced - пропустить, если история уже синхронизирована через SSE
   */
  addAssistantMessage(
    endpoint: EndpointConfig,
    context: WorkflowContext,
    responseData: any,
    replyText?: string,
    skipIfAlreadySynced = false
  ): void {
    addAssistantMessageToHistory(endpoint, context, responseData, replyText, skipIfAlreadySynced);
  }
}