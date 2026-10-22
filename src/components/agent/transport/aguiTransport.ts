import { EventBus } from '../core/eventBus';
import type { AgentConfig, TraceStep } from 'types';

/**
 * AG-UI Transport — читает SSE stream от AG-UI агента и маппит события на EventBus.
 *
 * SSE формат от сервера (стандартный):
 *   event: TEXT_MESSAGE_START
 *   data: {"messageId":"...","role":"assistant"}
 *
 *   event: TEXT_MESSAGE_CONTENT
 *   data: {"messageId":"...","delta":"text..."}
 *
 *   event: TEXT_MESSAGE_END
 *   data: {"messageId":"..."}
 *
 * Или просто data (без event type):
 *   data: {"type":"TEXT_MESSAGE_START",...}
 *
 *   data: {"type":"TEXT_MESSAGE_CONTENT","delta":"..."}
 */

export class AGUITransport {
  private abortController: AbortController | null = null;

  constructor(
    private config: AgentConfig,
    private bus: EventBus
  ) {}

  /**
   * Отправить сообщение агенту через AG-UI протокол.
   */
  async sendMessage(
    userInput: string,
    additionalContext: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const agentUrl = this.config.url;
    if (!agentUrl) {
      throw new Error('Agent URL is required for AG-UI mode');
    }

    this.abortController = new AbortController();
    const mergedSignal = signal || this.abortController.signal;

    const requestBody = {
      message: userInput,
      context: {
        ...additionalContext,
        user_input: userInput,
      },
    };

    // Use the first endpoint's URL and path
    const endpoint = this.config.endpoints[0];
    const baseUrl = (endpoint?.url || agentUrl).replace(/\/+$/, '');
    const endpointPath = endpoint?.path || '';
    const fullUrl = endpointPath ? `${baseUrl}${endpointPath}` : baseUrl;

    const ep = this.config.endpoints[0];
    const addNewLineBeforeContent = (ep?.streaming as any)?.aguiNewLineBeforeContent === true;

    const headers = this.buildHeaders(endpoint);

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: mergedSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let currentMessageId = '';

      const processEvents = (events: Array<{ type: string; delta?: string; [key: string]: any }>) => {
        for (const event of events) {
          const eventType = event.type?.toUpperCase();

          if (eventType === 'TEXT_MESSAGE_START') {
            currentMessageId = event.messageId || '';
            continue;
          }

          if (eventType === 'TEXT_MESSAGE_END') {
            currentMessageId = '';
            continue;
          }

          this.processEvent(event, onTrace);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const events = this.parseSSE(buffer);
        buffer = '';

        for (const event of events) {
          const eventType = event.type?.toUpperCase();

          if (eventType === 'TEXT_MESSAGE_CONTENT') {
            const content = event.delta || event.content || event.text || '';

            if (event.messageId === currentMessageId) {
              if (addNewLineBeforeContent) {
                fullResponse += '\n' + content;
                this.bus.emit('chunk', '\n' + content);
              } else {
                fullResponse += content;
                this.bus.emit('chunk', content);
              }
            }
          } else {
            processEvents([event]);
          }
        }
      }

      if (buffer.trim()) {
        const events = this.parseSSE(buffer);
        processEvents(events);
      }

      return fullResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return '';
      }
      throw error;
    }
  }

  /**
   * Получить список тредов — ищет endpoint по historyListOperation
   */
  async listThreads(onTrace?: (step: TraceStep) => void): Promise<any> {
    const ep = this.config.endpoints.find((e) => e.operation === this.config.historyListOperation);
    if (!ep) {
      throw new Error(`Endpoint for historyListOperation not found`);
    }
    const baseUrl = (ep.url || this.config.url).replace(/\/+$/, '');
    const listUrl = `${baseUrl}${ep.path}`;

    const headers = this.buildHeaders(ep);

    // History operations use a local AbortController to avoid
    // interference with the main sendMessage abortController.
    // If sendMessage was aborted earlier, this.abortController.signal
    // is already aborted and would cause fetch to fail immediately.
    const controller = new AbortController();

    try {
      const response = await fetch(listUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      onTrace?.({ type: 'threads:loaded', timestamp: Date.now(), data });
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Загрузить конкретный тред — ищет endpoint по historyLoadOperation
   */
  async loadThread(threadId: string, onTrace?: (step: TraceStep) => void): Promise<any> {
    const ep = this.config.endpoints.find((e) => e.operation === this.config.historyLoadOperation);
    if (!ep) {
      throw new Error(`Endpoint for historyLoadOperation not found`);
    }
    const baseUrl = (ep.url || this.config.url).replace(/\/+$/, '');
    const threadIdParam = this.config.threadIdParam || this.config.threadIdContextKey || 'chatId';
    const path = ep.path
      .replace(`{${threadIdParam}}`, encodeURIComponent(threadId))
      .replace(`{threadId}`, encodeURIComponent(threadId));
    const loadUrl = `${baseUrl}${path}`;

    const headers = this.buildHeaders(ep);

    // Local AbortController — не используем this.abortController,
    // т.к. он мог быть abort'нут ранее (при abort() в loadThread useChatMessages)
    const controller = new AbortController();

    try {
      const response = await fetch(loadUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      onTrace?.({ type: 'thread:loaded', timestamp: Date.now(), threadId, data });
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Отменить текущую операцию
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Построить HTTP заголовки
   */
  private buildHeaders(endpoint?: import('types').EndpointConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };

    const ep = endpoint || this.config.endpoints[0];
    if (ep?.headers) {
      Object.assign(headers, ep.headers);
    }

    return headers;
  }

  /**
   * Парсить SSE события из буфера.
   *
   * SSE формат:
   *   event: TEXT_MESSAGE_START\n
   *   data: {"messageId":"...","role":"assistant"}\n
   *   \n
   *
   * Или просто:
   *   data: {"type":"TEXT_MESSAGE_START",...}\n
   *   \n
   *
   * Или plain JSON (без префикса):
   *   {"type":"TEXT_MESSAGE_CONTENT","delta":"..."}\n
   *   \n
   */
  private parseSSE(buffer: string): Array<{
    type: string;
    delta?: string;
    [key: string]: any;
  }> {
    const events: Array<{ type: string; delta?: string; [key: string]: any }> = [];

    // Разделяем по двойным переносам строк (SSE separator)
    const blocks = buffer.split(/\n\n/);

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) {
        continue;
      }

      let eventType = '';
      let dataStr = '';

      // Парсим поля event: и data: построчно
      const lines = trimmed.split('\n');
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr = line.slice(5).trim();
        }
      }

      // Если нет data: — пробуем распарсить весь блок как JSON
      if (!dataStr) {
        // Пробуем распарсить как один JSON
        try {
          const json = JSON.parse(trimmed);
          if (json && typeof json === 'object' && json.type) {
            events.push({
              type: json.type.toUpperCase(),
              delta: json.delta,
              ...json,
            });
            continue;
          }
        } catch {
          // Пробуем разбить на несколько JSON объектов (формат 123.txt — склеенные JSON через пробел)
          const jsonObjects = this.extractJsonObjects(trimmed);
          for (const jsonStr of jsonObjects) {
            try {
              const json = JSON.parse(jsonStr);
              if (json && typeof json === 'object' && json.type) {
                events.push({
                  type: json.type.toUpperCase(),
                  delta: json.delta,
                  ...json,
                });
              }
            } catch {
              // Пропускаем
            }
          }
        }
        continue;
      }

      // Парсим JSON из data:
      try {
        const event = JSON.parse(dataStr);

        // Если в JSON есть type — используем его как eventType
        const type = eventType || event.type || '';

        if (!type) {
          continue;
        }

        events.push({
          type: type.toUpperCase(),
          delta: event.delta,
          ...event,
        });
      } catch {
        // Не удалось распарсить — пропускаем
      }
    }

    return events;
  }

  /**
   * Извлечь несколько JSON объектов из строки, где они склеены (например: '{"a":1} {"b":2}').
   * Используется для парсинга формата debug trace (123.txt).
   */
  private extractJsonObjects(text: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          objects.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return objects;
  }

  /**
   * Обработать AG-UI событие и эмитить в EventBus
   */
  private processEvent(
    event: { type: string; delta?: string; [key: string]: any },
    onTrace?: (step: TraceStep) => void
  ): void {
    const eventType = event.type?.toUpperCase();

    switch (eventType) {
      // === Lifecycle ===
      case 'RUN_STARTED':
        onTrace?.({ type: 'run:start', timestamp: Date.now(), runId: event.runId, threadId: event.threadId });
        break;

      case 'RUN_FINISHED':
        onTrace?.({ type: 'run:end', timestamp: Date.now(), runId: event.runId });
        break;

      // === Steps ===
      case 'STEP_STARTED':
        onTrace?.({
          type: 'step:start',
          timestamp: Date.now(),
          stepName: event.stepName,
        });
        break;

      case 'STEP_FINISHED':
        onTrace?.({
          type: 'step:end',
          timestamp: Date.now(),
          stepName: event.stepName,
        });
        break;

      // === Text Messages ===
      case 'TEXT_MESSAGE_START':
        onTrace?.({
          type: 'text:start',
          timestamp: Date.now(),
          messageId: event.messageId,
          role: event.role,
        });
        break;

      case 'TEXT_MESSAGE_CONTENT':
        // Chunk эмитится в основном цикле — не дублируем здесь
        onTrace?.({
          type: 'text:chunk',
          timestamp: Date.now(),
          messageId: event.messageId,
          delta: event.delta,
        });
        break;

      case 'TEXT_MESSAGE_END':
        onTrace?.({
          type: 'text:end',
          timestamp: Date.now(),
          messageId: event.messageId,
        });
        break;

      // === Reasoning ===
      case 'REASONING_START':
        this.bus.emit('reasoning:start', { payload: {} });
        onTrace?.({ type: 'reasoning:start', timestamp: Date.now() });
        break;

      case 'REASONING_CONTENT':
        const reasoningDelta = event.delta || '';
        this.bus.emit('reasoning:chunk', reasoningDelta);
        onTrace?.({ type: 'reasoning:chunk', timestamp: Date.now(), delta: reasoningDelta });
        break;

      case 'REASONING_END':
        this.bus.emit('reasoning:end', '');
        onTrace?.({ type: 'reasoning:end', timestamp: Date.now() });
        break;

      // === Tool Calls ===
      case 'TOOL_CALL_START':
        onTrace?.({
          type: 'tool:start',
          timestamp: Date.now(),
          toolCallId: event.toolCallId,
          toolName: event.toolCallName,
        });
        break;

      case 'TOOL_CALL_ARGS':
        onTrace?.({
          type: 'tool:args',
          timestamp: Date.now(),
          toolCallId: event.toolCallId,
          delta: event.delta,
        });
        break;

      case 'TOOL_CALL_END':
        onTrace?.({
          type: 'tool:end',
          timestamp: Date.now(),
          toolCallId: event.toolCallId,
        });
        break;

      case 'TOOL_CALL_RESULT':
        onTrace?.({
          type: 'tool:result',
          timestamp: Date.now(),
          toolCallId: event.toolCallId,
          content: event.content,
          messageId: event.messageId,
        });
        break;

      // === State ===
      case 'STATE_SNAPSHOT':
        this.bus.emit('contextUpdate', event.snapshot || event.state);
        onTrace?.({ type: 'state:snapshot', timestamp: Date.now(), snapshot: event.snapshot });
        break;

      case 'STATE_DELTA':
        this.bus.emit('contextUpdate', event.delta || event.patch);
        onTrace?.({ type: 'state:delta', timestamp: Date.now(), delta: event.delta });
        break;

      // === Custom events (график, кастомный контент и т.д.) ===
      case 'CUSTOM':
        onTrace?.({ type: 'custom', timestamp: Date.now(), data: event });
        this.bus.emit('custom', { payload: event });
        break;

      // === Activity (UI-виджеты: кнопки, формы, прогресс) — AG-UI standard ===
      case 'ACTIVITY_SNAPSHOT':
        onTrace?.({
          type: 'activity:snapshot',
          timestamp: Date.now(),
          messageId: event.messageId,
          activityType: event.activityType,
          content: event.content,
        });
        // Если activityType === "interactive" — эмитим interactive event
        if (event.activityType === 'interactive') {
          const payload = event.content || {};
          // Поддержка старого формата (options/fields) и нового (actions/form)
          const interactivePayload: any = {
            actions: payload.actions ?? payload.options,
            form: payload.form ?? payload.fields,
            submitLabel: payload.submitLabel,
          };
          this.bus.emit('interactive', interactivePayload);
        }
        break;

      case 'ACTIVITY_DELTA':
        onTrace?.({
          type: 'activity:delta',
          timestamp: Date.now(),
          messageId: event.messageId,
          activityType: event.activityType,
          patch: event.patch,
        });
        // Если activityType === "interactive" — эмитим обновление
        if (event.activityType === 'interactive') {
          const payload = event.patch || {};
          this.bus.emit('interactive', payload);
        }
        break;

      // === Error ===
      case 'ERROR':
        onTrace?.({ type: 'error', timestamp: Date.now(), error: event.error || event.message });
        break;

      // === Unknown events — логирование для отладки ===
      default:
        console.warn('[AGUITransport] Unknown event type:', eventType, event);
        onTrace?.({
          type: 'unknown',
          timestamp: Date.now(),
          eventType,
          event,
        });
        break;
    }
  }
}
