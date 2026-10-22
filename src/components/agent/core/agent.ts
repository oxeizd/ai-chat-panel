import { EventBus } from './eventBus';
import { AgentConfig, TraceStep, AgentEvent } from 'types';
import { executeWorkflow } from './workflowManager';
import { createAgentConfig } from '../config/agentConfig';
import { sendOperation } from '../transport/sender';
import { AGUITransport } from '../transport/aguiTransport';

export class Agent {
  private config: AgentConfig;
  private bus = new EventBus();
  private session: { started: boolean; context: Record<string, any> } = {
    started: false,
    context: {},
  };
  private processing = false;
  private abortController?: AbortController;
  private aguiTransport?: AGUITransport;

  constructor(rawConfig: unknown) {
    this.config = createAgentConfig(rawConfig);
  }

  on<K extends AgentEvent['type']>(
    event: K,
    handler: (payload: Extract<AgentEvent, { type: K }>['payload']) => void
  ): () => void {
    return this.bus.on(event, handler as any);
  }

  onChunk(handler: (chunk: string) => void): () => void {
    return this.on('chunk', handler);
  }

  onReasoningStart(handler: (payload?: { title?: string }) => void): () => void {
    return this.on('reasoning:start', handler);
  }

  onReasoningChunk(handler: (chunk: string) => void): () => void {
    return this.on('reasoning:chunk', handler);
  }

  onReasoningEnd(handler: (fullText: string) => void): () => void {
    return this.on('reasoning:end', handler);
  }

  onContextUpdate(handler: (ctx: Record<string, any>) => void): () => void {
    return this.on('contextUpdate', handler);
  }

  getContextValue(key: string): any {
    return this.session.context[key];
  }

  getContext(): Record<string, any> {
    return { ...this.session.context };
  }

  setContext(partial: Record<string, any>): void {
    this.session.context = {
      ...this.session.context,
      ...partial,
    };

    this.bus.emit('contextUpdate', { ...this.session.context });
  }

  /**
   * Помечает сессию как уже начатую.
   *
   * Вызывается после загрузки диалога из истории.
   * Поэтому следующий пользовательский send продолжает тред
   * и не запускает startupOperation.
   */
  markSessionStarted(): void {
    this.session.started = true;
  }

  abort(): void {
    this.aguiTransport?.abort();
    this.abortController?.abort();
  }

  async sendMessage(
    userInput: string,
    additionalContext: Record<string, any> = {},
    onTrace?: (step: TraceStep) => void
  ): Promise<string> {
    if (this.processing) {
      throw new Error('Agent is already processing');
    }

    this.processing = true;
    this.abortController = new AbortController();

    try {
      this.session.context = {
        ...this.session.context,
        ...additionalContext,
        user_input: userInput,
      };

      // AG-UI mode — используем AG-UI transport вместо workflow
      const ep = this.config.endpoints[0];
      if (ep?.streaming?.enabled === true && ep.streaming.parseStrategy === 'agui') {
        if (!this.aguiTransport) {
          this.aguiTransport = new AGUITransport(this.config, this.bus);
        }

        const reply = await this.aguiTransport.sendMessage(
          userInput,
          additionalContext,
          onTrace,
          this.abortController.signal
        );

        this.bus.emit('contextUpdate', { ...this.session.context });

        return reply;
      }

      const result = await executeWorkflow(this.config, this.session, this.bus, {
        onTrace,
        abortOnError: true,
        signal: this.abortController.signal,
      });

      if (!result.success) {
        const errorMessage = result.stepResults.find((step) => !step.ok)?.error || 'Workflow failed';
        throw new Error(errorMessage);
      }

      const lastStep = result.stepResults.filter((step) => step.ok).pop();

      let reply = '';

      if (lastStep?.data) {
        reply = typeof lastStep.data === 'string' ? lastStep.data : JSON.stringify(lastStep.data);
      }

      if (reply && !lastStep?.streaming) {
        this.bus.emit('chunk', reply);
      }

      const fileAttachment = lastStep?.fileAttachment;

      if (fileAttachment) {
        this.bus.emit('fileAttachment', fileAttachment);
      }

      const interactive = lastStep?.interactive;

      if (interactive) {
        this.bus.emit('interactive', interactive);
      }

      this.bus.emit('contextUpdate', { ...this.session.context });

      return reply;
    } finally {
      this.processing = false;
      this.abortController = undefined;
    }
  }

  /**
   * Выполнить произвольную операцию с текущим session context.
   * Используется для history list/load/delete и dynamic suggestions.
   */
  async runOperation(operation: string, additionalContext: Record<string, any> = {}): Promise<any> {
    if (this.processing) {
      // History-операции (list/load/delete) должны работать даже во время processing,
      // потому что пользователь может переключить тред пока агент отвечает
      const historyOps = [
        this.config.historyListOperation,
        this.config.historyLoadOperation,
        this.config.historyDeleteOperation,
      ];
      if (!historyOps.includes(operation)) {
        throw new Error('Agent is busy');
      }
      // Ждём завершения текущей операции перед выполнением history-операции
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!this.processing) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }

    const context = {
      ...this.session.context,
      ...additionalContext,
    };

    // AG-UI mode — делегируем history-операции в AGUITransport
    const ep = this.config.endpoints[0];
    const isAGUI = ep?.streaming?.enabled === true && ep.streaming.parseStrategy === 'agui';
    console.log(
      '[Agent.runOperation] operation:',
      operation,
      'isAGUI:',
      isAGUI,
      'historyListOperation:',
      this.config.historyListOperation
    );

    if (isAGUI) {
      if (!this.aguiTransport) {
        this.aguiTransport = new AGUITransport(this.config, this.bus);
      }

      // History list — всегда используем AGUI endpoint /threads
      if (operation === this.config.historyListOperation) {
        const data = await this.aguiTransport.listThreads();
        this.bus.emit('contextUpdate', { ...this.session.context });
        return data;
      }

      // History load — извлекаем threadId из контекста
      if (operation === this.config.historyLoadOperation) {
        const threadIdParam = this.config.threadIdParam || this.config.threadIdContextKey || 'chatId';
        const threadId = additionalContext[threadIdParam] || this.session.context[threadIdParam];

        if (!threadId) {
          throw new Error('threadId is required for history load operation');
        }

        const data = await this.aguiTransport.loadThread(threadId);
        this.bus.emit('contextUpdate', { ...this.session.context });
        return data;
      }

      // History delete — AGUI протокол пока не поддерживает удаление,
      // но если endpoint настроен — пробуем через sendOperation
      if (operation === this.config.historyDeleteOperation) {
        // AGUI protocol doesn't have a built-in delete endpoint.
        // Fall back to sendOperation if a delete endpoint is configured.
      }
    }

    // Non-AGUI — используем sendOperation, он сам найдёт endpoint по имени операции
    const result = await sendOperation(this.config, operation, context, this.bus, {
      signal: this.abortController?.signal,
    });

    if (!result.ok) {
      throw new Error(result.error || 'Operation failed');
    }

    this.session.context = {
      ...this.session.context,
      ...(result.context ?? {}),
    };

    this.bus.emit('contextUpdate', { ...this.session.context });

    return result.data;
  }

  async resetSession(): Promise<void> {
    if (this.processing) {
      throw new Error('Cannot reset while processing');
    }

    this.aguiTransport = undefined;

    this.session = {
      started: false,
      context: {},
    };

    this.bus.emit('contextUpdate', {});
  }
}
