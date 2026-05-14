export interface SeparateSSECallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onThinkingStart?: (title?: string) => void;
  onThinkingEnd?: () => void;
  onTrace?: (step: any) => void;
  verboseTrace?: boolean; // выводить каждую сырую строку
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

  const { onChunk, onReasoningChunk, onThinkingStart, onThinkingEnd, onTrace, verboseTrace = false } = callbacks;

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

        if (verboseTrace && onTrace) {
          onTrace({
            type: 'raw_sse_line',
            timestamp: Date.now(),
            rawLine: trimmed,
          });
        }

        let content = trimmed;
        if (trimmed.startsWith('data: ')) {
          content = trimmed.slice(6);
        }
        if (content === '[DONE]') {
          if (onTrace) {
            onTrace({ type: 'sse_separate_end', timestamp: Date.now(), reason: 'DONE' });
          }
          continue;
        }

        let event: any;
        try {
          event = JSON.parse(content);
        } catch (err) {
          if (onTrace) {
            onTrace({
              type: 'sse_parse_error',
              timestamp: Date.now(),
              rawLine: trimmed,
              error: String(err),
            });
          }
          continue;
        }

        const type = event.type;

        if (onTrace) {
          onTrace({
            type: 'sse_separate_event',
            timestamp: Date.now(),
            eventType: type,
            eventData: event,
          });
        }

        // Обычный текст
        if (type === 'TEXT_MESSAGE_CONTENT' || type === 'TEXT_MESSAGE_CHUNK') {
          if (event.delta) {
            fullText += event.delta;
            onChunk(event.delta);
            if (onTrace) {
              onTrace({ type: 'text_chunk', timestamp: Date.now(), chunk: event.delta });
            }
          }
        }

        // Reasoning текст
        if (type === eventMapping.thinkingContent && event.delta) {
          fullReasoning += event.delta;
          onReasoningChunk(event.delta);
          if (onTrace) {
            onTrace({ type: 'reasoning_chunk', timestamp: Date.now(), chunk: event.delta });
          }
        }

        // Начало мышления
        if (eventMapping.thinkingStart && type === eventMapping.thinkingStart) {
          onThinkingStart?.(event.title);
          if (onTrace) {
            onTrace({ type: 'thinking_start', timestamp: Date.now(), title: event.title });
          }
        }

        // Конец мышления
        if (eventMapping.thinkingEnd && type === eventMapping.thinkingEnd) {
          onThinkingEnd?.();
          if (onTrace) {
            onTrace({ type: 'thinking_end', timestamp: Date.now() });
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullText, fullReasoning };
}
