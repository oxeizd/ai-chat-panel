export interface SeparateSSECallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onThinkingStart?: (title?: string) => void;
  onThinkingEnd?: () => void;
  onTrace?: (step: any) => void;
}

export async function parseSeparateSSE(
  response: Response,
  eventMapping: {
    thinkingContent: string;
    thinkingStart?: string;
    thinkingEnd?: string;
  },
  callbacks: SeparateSSECallbacks
): Promise<{ fullText: string; fullReasoning: string }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let fullReasoning = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        // Удаляем префикс data: если есть
        let content = trimmed;
        if (trimmed.startsWith('data: ')) {
          content = trimmed.slice(6);
        }
        if (content === '[DONE]') {
          continue;
        }

        let event: any;
        try {
          event = JSON.parse(content);
        } catch (err) {
          callbacks.onTrace?.({ type: 'sse_parse_error', timestamp: Date.now(), line: trimmed, error: String(err) });
          continue;
        }

        const type = event.type;

        // Обычный текст
        if (type === 'TEXT_MESSAGE_CONTENT' || type === 'TEXT_MESSAGE_CHUNK') {
          if (event.delta) {
            fullText += event.delta;
            callbacks.onChunk(event.delta);
          }
        }

        // Текст мысли
        if (type === eventMapping.thinkingContent && event.delta) {
          fullReasoning += event.delta;
          callbacks.onReasoningChunk(event.delta);
        }

        // Начало мышления (опционально)
        if (eventMapping.thinkingStart && type === eventMapping.thinkingStart) {
          callbacks.onThinkingStart?.(event.title);
        }

        // Конец мышления (опционально)
        if (eventMapping.thinkingEnd && type === eventMapping.thinkingEnd) {
          callbacks.onThinkingEnd?.();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullText, fullReasoning };
}
