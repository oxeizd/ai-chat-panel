import { StreamingConfig } from 'types';
import { extractValueByPath } from './objectHelpers';
import { STREAMING_DEFAULTS } from '../constants';

/**
 * Проверяет, включена ли потоковая передача для эндпоинта.
 * @param endpoint - конфигурация эндпоинта
 * @returns true, если streaming включён
 */
export const isStreamingEnabled = (endpoint: { streaming?: boolean | StreamingConfig }): boolean => {
  return endpoint.streaming === true || (endpoint.streaming as StreamingConfig)?.enabled === true;
};

/**
 * Возвращает полную конфигурацию стриминга, объединяя значения по умолчанию.
 * @param endpoint - конфигурация эндпоинта
 * @returns объект StreamingConfig или null, если стриминг отключён
 */
export const getStreamConfig = (endpoint: { streaming?: boolean | StreamingConfig }) => {
  const defaultConfig: StreamingConfig = {
    enabled: true,
    textPath: STREAMING_DEFAULTS.textPath,
    delimiter: STREAMING_DEFAULTS.delimiter,
    dataPrefix: STREAMING_DEFAULTS.dataPrefix,
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

/**
 * Определяет, является ли ответ SSE на основе заголовка Content-Type.
 * @param response - объект Response
 * @returns true, если Content-Type содержит 'text/event-stream'
 */
export const detectSSEByContent = (response: Response): boolean => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/event-stream');
};

/**
 * Разбор потока Server-Sent Events.
 * @param response - ответ с ReadableStream
 * @param textPath - путь для извлечения текстового содержимого из чанка (JSON-путь)
 * @param dataPrefix - префикс строки данных ("data: ")
 * @param onChunk - колбэк для каждого текстового чанка
 * @param onHistorySync - колбэк для событий синхронизации истории
 * @param onTrace - колбэк для трассировки ошибок парсинга
 * @returns объект с полным текстом, последним событием и массивом всех событий
 */
export async function parseSSEStream(
  response: Response,
  textPath: string,
  dataPrefix: string,
  onChunk?: (chunk: string) => void,
  onHistorySync?: (event: any) => void,
  onTrace?: (step: any) => void,
  onReasoningChunk?: (chunk: string) => void
): Promise<{ fullText: string; finalEvent?: any; rawEvents: any[] }> {
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
          continue; // комментарий
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

          let reasoningChunk: string | undefined;

          if (event.choices?.[0]) {
            reasoningChunk = event.choices[0].delta?.reasoning_content;
          }
          if (!reasoningChunk && event.type === 'REASONING' && event.delta) {
            reasoningChunk = event.delta;
          }
          if (reasoningChunk !== undefined && onReasoningChunk) {
            onReasoningChunk(reasoningChunk);
          }

          finalEvent = event;

          let chunkText: string | undefined;
          // Попытка извлечь текст разными способами
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
          // Ошибка парсинга строки как JSON – логируем через onTrace
          if (onTrace) {
            onTrace({
              type: 'sse_parse_error',
              timestamp: Date.now(),
              line: trimmed,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }
    return { fullText: fullResponse, finalEvent, rawEvents };
  } catch (err) {
    // При ошибке отменяем поток
    try {
      await response.body?.cancel();
    } catch (cancelErr) {}
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
