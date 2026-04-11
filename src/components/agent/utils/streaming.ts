import { StreamingConfig } from 'types';
import { extractValueByPath } from './objectHelpers';

export const isStreamingEnabled = (endpoint: { streaming?: boolean | StreamingConfig }): boolean => {
  return endpoint.streaming === true || (endpoint.streaming as StreamingConfig)?.enabled === true;
};

export const getStreamConfig = (endpoint: { streaming?: boolean | StreamingConfig }) => {
  const defaultTextPath = 'choices.0.delta.content';
  const defaultConfig: StreamingConfig = {
    enabled: true,
    textPath: defaultTextPath,
    delimiter: '\n\n',
    dataPrefix: 'data:',
  };

  const streamingEnabled = isStreamingEnabled(endpoint);
  if (!streamingEnabled) {
    return null;
  }

  if (typeof endpoint.streaming === 'object') {
    return { ...defaultConfig, ...endpoint.streaming };
  }
  return defaultConfig;
};

export const detectSSEByContent = (response: Response): boolean => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/event-stream');
};

export async function parseSSEStream(
  response: Response,
  textPath: string,
  dataPrefix: string,
  onChunk?: (chunk: string) => void,
  onHistorySync?: (event: any) => void
): Promise<{ fullText: string; finalEvent?: any; rawEvents: any[] }> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let buffer = '';
  let fullResponse = '';
  let finalEvent: any = undefined;
  const rawEvents: any[] = [];
  let streamClosed = false;

  try {
    reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamClosed = true;
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

        let isDone = false;
        if (trimmed === '[DONE]') {
          isDone = true;
        } else if (dataPrefix && trimmed.startsWith(dataPrefix)) {
          const afterPrefix = trimmed.slice(dataPrefix.length).trim();
          if (afterPrefix === '[DONE]') {
            isDone = true;
          }
        }
        if (isDone) {
          streamClosed = true;
          return { fullText: fullResponse, finalEvent, rawEvents };
        }

        // Извлечение JSON-строки
        let jsonStr = trimmed;
        if (dataPrefix && trimmed.startsWith(dataPrefix)) {
          jsonStr = trimmed.slice(dataPrefix.length).trim();
        }

        try {
          const event = JSON.parse(jsonStr);
          rawEvents.push(event);
          if (onHistorySync) {
            onHistorySync(event);
          }
          finalEvent = event;

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
        } catch (e) {
          // Игнорируем строки, которые не являются валидным JSON
        }
      }
    }
    return { fullText: fullResponse, finalEvent, rawEvents };
  } catch (err) {
    if (!streamClosed) {
      await response.body?.cancel().catch(() => {});
    }
    throw err;
  } finally {
    if (reader) {
      reader.releaseLock();
    }
  }
}
