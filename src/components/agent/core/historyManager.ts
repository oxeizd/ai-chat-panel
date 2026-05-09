import { EndpointConfig } from '../shared/types';
import { WorkflowContext } from './contextManager';

/**
 * Менеджер истории диалога.
 * Отвечает за добавление сообщений пользователя и ассистента в контекст сессии.
 */
export class HistoryManager {
  /**
   * Добавляет сообщение ассистента в историю контекста.
   * @param ep - конфигурация эндпоинта
   * @param ctx - мутабельный контекст
   * @param responseData - полные данные ответа (JSON)
   * @param replyText - текст ответа для отображения
   * @param skipIfSynced - пропустить, если история уже синхронизирована через SSE (historySync)
   */
  addAssistantMessage(
    ep: EndpointConfig,
    ctx: WorkflowContext,
    responseData: any,
    replyText?: string,
    skipIfSynced = false
  ): void {
    const ch = ep.conversationHistory;
    const cfg = ch === true ? { enabled: true } : ch && typeof ch === 'object' ? ch : { enabled: false };

    if (!cfg.enabled) {
      return;
    }
    if (skipIfSynced) {
      return;
    }
    if (!replyText) {
      return;
    }

    if (!ctx.messages || !Array.isArray(ctx.messages)) {
      ctx.messages = [];
    }

    const { choices, ...upperFields } = responseData || {};
    const messageFields = choices?.[0]?.message || {};
    const fullAssistantData = { ...upperFields, ...messageFields };
    const fields = cfg.assistantMessageFields;

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

  /**
   * Добавляет последнее сообщение пользователя из тела запроса в историю.
   * @param ep - конфигурация эндпоинта
   * @param ctx - мутабельный контекст
   * @param requestBody - полное тело запроса (до отправки)
   */
  addUserMessage(ep: EndpointConfig, ctx: WorkflowContext, requestBody: any): void {
    const ch = ep.conversationHistory;
    const cfg = ch === true ? { enabled: true } : ch && typeof ch === 'object' ? ch : { enabled: false };

    if (!cfg.enabled) {
      return;
    }

    if (!ctx.messages || !Array.isArray(ctx.messages)) {
      ctx.messages = [];
    }

    const requestMessages = requestBody.messages;
    if (!Array.isArray(requestMessages) || requestMessages.length === 0) {
      return;
    }

    const lastUserMsg = requestMessages[requestMessages.length - 1];
    const lastCtxMsg = ctx.messages[ctx.messages.length - 1];

    const shouldAdd = !lastCtxMsg || lastCtxMsg.role !== lastUserMsg.role || lastCtxMsg.content !== lastUserMsg.content;

    if (!shouldAdd) {
      return;
    }

    let msgToStore: any;
    const fields = cfg.userMessageFields;

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
   * Сбрасывает историю сообщений в контексте.
   * @param ctx - мутабельный контекст (передаём через this.ctx.context)
   */
  reset(ctx: WorkflowContext): void {
    if (ctx.messages) {
      delete ctx.messages;
      // или ctx.messages = [];
    }
  }
}
