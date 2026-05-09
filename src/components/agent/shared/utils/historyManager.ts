import { WorkflowContext } from 'components/agent/core/context';

/**
 * Добавляет сообщение ассистента в историю контекста.
 * @param endpoint - конфигурация эндпоинта
 * @param context - мутабельный контекст
 * @param responseData - данные ответа
 * @param replyText - текст ответа
 * @param skipIfAlreadySynced - флаг пропуска, если история синхронизировалась из SSE
 */
export const addAssistantMessageToHistory = (
  endpoint: { preserveConversationHistory?: boolean; assistantMessageFields?: string[] },
  context: WorkflowContext,
  responseData: any,
  replyText?: string,
  skipIfAlreadySynced = false
): void => {
  if (!endpoint.preserveConversationHistory) {
    return;
  }

  if (skipIfAlreadySynced) {
    return;
  }

  if (!replyText) {
    return;
  }

  if (!context.messages || !Array.isArray(context.messages)) {
    context.messages = [];
  }

  const { choices, ...upperFields } = responseData;
  const messageFields = choices?.[0]?.message || {};
  let fullAssistantData = { ...upperFields, ...messageFields };

  let assistantMsg: any;
  if (endpoint.assistantMessageFields?.length) {
    assistantMsg = {};
    for (const field of endpoint.assistantMessageFields) {
      const value = messageFields[field] ?? upperFields[field];
      if (value !== undefined) {
        assistantMsg[field] = value;
      }
    }
  } else {
    assistantMsg = fullAssistantData;
  }

  if (replyText && assistantMsg.content === undefined) {
    assistantMsg.content = replyText;
  }

  if (Object.keys(assistantMsg).length > 0) {
    context.messages.push(assistantMsg);
  }
};

/**
 * Добавляет последнее сообщение пользователя из тела запроса в историю.
 * @param endpoint - конфигурация эндпоинта
 * @param context - мутабельный контекст
 * @param mergedBody - полное тело запроса
 */
export const addUserMessageToHistory = (
  endpoint: { preserveConversationHistory?: boolean; userMessageFields?: string[] },
  context: WorkflowContext,
  mergedBody: any
): void => {
  if (!endpoint.preserveConversationHistory) {
    return;
  }

  if (!context.messages || !Array.isArray(context.messages)) {
    context.messages = [];
  }

  const requestMessages = mergedBody.messages;
  if (!Array.isArray(requestMessages) || requestMessages.length === 0) {
    return;
  }

  const lastUserMessageFromRequest = requestMessages[requestMessages.length - 1];
  const lastContextMsg = context.messages[context.messages.length - 1];

  const shouldAdd =
    !lastContextMsg ||
    lastContextMsg.role !== lastUserMessageFromRequest.role ||
    lastContextMsg.content !== lastUserMessageFromRequest.content;

  if (!shouldAdd) {
    return;
  }

  let messageToStore: any;
  if (endpoint.userMessageFields?.length) {
    messageToStore = {};
    for (const field of endpoint.userMessageFields) {
      if (lastUserMessageFromRequest[field] !== undefined) {
        messageToStore[field] = lastUserMessageFromRequest[field];
      }
    }
  } else {
    messageToStore = { ...lastUserMessageFromRequest };
  }

  if (Object.keys(messageToStore).length > 0) {
    context.messages.push(messageToStore);
  }
};
