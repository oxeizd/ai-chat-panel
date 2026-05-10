import { ResolvedEndpointConfig } from '../config/types';
import { WorkflowContext } from './contextManager';

export class HistoryManager {
  /**
   * Добавляет сообщение пользователя из тела запроса (resolved.body) в историю.
   * @param resolved - нормализованная конфигурация эндпоинта
   * @param ctx - мутабельный контекст
   */
  addUserMessage(resolved: ResolvedEndpointConfig, ctx: WorkflowContext): void {
    const hist = resolved.conversationHistory;

    if (!hist?.enabled) {
      return;
    }

    if (!ctx.messages) {
      ctx.messages = [];
    }

    const requestBody = resolved.body;
    const requestMessages = requestBody?.messages;
    if (!Array.isArray(requestMessages) || requestMessages.length === 0) {
      return;
    }

    const lastUserMsg = requestMessages[requestMessages.length - 1];
    const lastCtxMsg = ctx.messages[ctx.messages.length - 1];
    const shouldAdd = !lastCtxMsg || lastCtxMsg.role !== lastUserMsg.role || lastCtxMsg.content !== lastUserMsg.content;
    if (!shouldAdd) {
      return;
    }

    const fields = hist.userMessageFields;
    let msgToStore: any;
    if (fields?.length) {
      msgToStore = {};
      for (const field of fields) {
        if (lastUserMsg[field] !== undefined) {
          msgToStore[field] = lastUserMsg[field];
        }
      }
    } else {
      msgToStore = { ...lastUserMsg };
    }
    if (Object.keys(msgToStore).length > 0) {
      ctx.messages.push(msgToStore);
    }
  }

  /**
   * Добавляет сообщение ассистента в историю.
   * @param resolved - нормализованная конфигурация эндпоинта
   * @param ctx - мутабельный контекст
   * @param responseData - полные данные ответа (JSON)
   * @param replyText - текст ответа для отображения
   * @param skipIfSynced - пропустить, если история уже синхронизирована через SSE
   */
  addAssistantMessage(
    resolved: ResolvedEndpointConfig,
    ctx: WorkflowContext,
    responseData: any,
    replyText?: string
  ): void {
    const hist = resolved.conversationHistory;

    if (!hist) {
      return;
    }

    if (!replyText) {
      return;
    }

    if (!ctx.messages) {
      ctx.messages = [];
    }

    const { choices, ...upperFields } = responseData || {};
    const messageFields = choices?.[0]?.message || {};
    const fullAssistantData = { ...upperFields, ...messageFields };
    const fields = hist.assistantMessageFields;

    let assistantMsg: any;
    if (fields?.length) {
      assistantMsg = {};
      for (const field of fields) {
        const value = messageFields[field] ?? upperFields[field];
        if (value !== undefined) {
          assistantMsg[field] = value;
        }
      }
    } else {
      assistantMsg = fullAssistantData;
    }
    if (assistantMsg.content === undefined) {
      assistantMsg.content = replyText;
    }
    if (Object.keys(assistantMsg).length > 0) {
      ctx.messages.push(assistantMsg);
    }
  }

  reset(ctx: WorkflowContext): void {
    if (ctx.messages) {
      delete ctx.messages;
    }
  }
}
