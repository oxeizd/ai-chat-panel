import { extractValueByPath } from 'components/agent/shared/utils/objectHelpers';

export interface ParseSSEOptions {
  textPath: string;
  dataPrefix: string;
  reasoningApiField?: string;
  onChunk?: (chunk: string) => void;
  onHistorySync?: (event: any) => void;
  onTrace?: (step: any) => void;
  onReasoningChunk?: (chunk: string) => void;
  verboseTrace?: boolean;
}

export async function parseSSEStream(
  response: Response,
  options: ParseSSEOptions
): Promise<{ fullText: string; finalEvent?: any; rawEvents: any[] }> {
  const { textPath, dataPrefix, reasoningApiField, onChunk, onHistorySync, onTrace, onReasoningChunk } = options;

  if (!response.body) {
    throw new Error('Response body is empty');
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let buffer = '';
  let fullResponse = '';
  let finalEvent: any = undefined;
  const rawEvents: any[] = [];

  try {
    reader = response.body.getReader();
    const decoder = new TextDecoder();

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

        let content = trimmed;
        if (trimmed.startsWith(dataPrefix)) {
          content = trimmed.slice(dataPrefix.length).trim();
        }

        // [DONE] маркер
        if (content === '[DONE]') {
          return { fullText: fullResponse, finalEvent, rawEvents };
        }

        try {
          const event = JSON.parse(content);
          rawEvents.push(event);

          if (onHistorySync) {
            onHistorySync(event);
          }

          // Извлечение reasoning
          let reasoningChunk: string | undefined;
          if (reasoningApiField) {
            const extracted = extractValueByPath(event, reasoningApiField);
            if (typeof extracted === 'string') {
              reasoningChunk = extracted;
            }
          }
          if (!reasoningChunk && event.choices?.[0]) {
            reasoningChunk = event.choices[0].delta?.reasoning_content;
          }
          if (!reasoningChunk && event.type === 'REASONING' && event.delta) {
            reasoningChunk = event.delta;
          }
          if (reasoningChunk && onReasoningChunk) {
            onReasoningChunk(reasoningChunk);
          }

          finalEvent = event;

          // Извлечение обычного текста
          let chunkText: string | undefined;
          if (event.choices?.[0]) {
            chunkText = event.choices[0].delta?.content ?? event.choices[0].message?.content;
          }
          if (!chunkText && event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
            chunkText = event.delta;
          }
          if (!chunkText && textPath) {
            const maybe = extractValueByPath(event, textPath);
            if (maybe !== undefined && maybe !== null) {
              chunkText = String(maybe);
            }
          }

          if (chunkText) {
            fullResponse += chunkText;
            if (onChunk) {
              onChunk(chunkText);
            }
          }
        } catch (err) {
          // Ошибка парсинга – выводим строку целиком
          if (onTrace) {
            onTrace({
              type: 'sse_parse_error',
              timestamp: Date.now(),
              rawLine: trimmed,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    return { fullText: fullResponse, finalEvent, rawEvents };
  } catch (err) {
    if (onTrace) {
      onTrace({
        type: 'error',
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      await response.body?.cancel();
    } catch {}
    throw err;
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {}
      reader.releaseLock();
    }
  }
}

export const detectSSEByContent = (response: Response): boolean => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/event-stream');
};
