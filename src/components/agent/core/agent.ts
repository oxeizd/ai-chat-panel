import { EventBus } from './eventBus';
import { AgentConfig, TraceStep, AgentEvent } from 'types';
import { executeWorkflow } from './workflowManager';
import { createAgentConfig } from '../config/agentConfig';
import { sendOperation } from '../transport/sender';

export class Agent {
  private config: AgentConfig;
  private bus = new EventBus();
  private session: { started: boolean; context: Record<string, any> } = {
    started: false,
    context: {},
  };
  private processing = false;
  private abortController?: AbortController;

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
      throw new Error('Agent is busy');
    }

    const context = {
      ...this.session.context,
      ...additionalContext,
    };

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

    this.session = {
      started: false,
      context: {},
    };

    this.bus.emit('contextUpdate', {});
  }
}
