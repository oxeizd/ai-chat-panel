let messageIdCounter = 0;

export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${messageIdCounter++}`;
};
