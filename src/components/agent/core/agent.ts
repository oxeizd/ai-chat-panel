import { EventBus } from './eventBus';
import { AgentConfig, TraceStep, AgentEvent } from 'types';
import { executeWorkflow } from './workflowManager';
import { createAgentConfig } from '../config/agentConfig';

export class Agent {
  private config: AgentConfig;
  private bus = new EventBus();
  private session: { started: boolean; context: Record<string, any> } = { started: false, context: {} };
  private processing = false;
  private abortController?: AbortController;

  constructor(rawConfig: unknown) {
    this.config = createAgentConfig(rawConfig);
  }

  // Подписка на события
  on<K extends AgentEvent['type']>(
    event: K,
    handler: (payload: Extract<AgentEvent, { type: K }>['payload']) => void
  ): () => void {
    return this.bus.on(event, handler as any);
  }

  // обёртки (опционально)
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
        const errorMsg = result.stepResults.find((r) => !r.ok)?.error || 'Workflow failed';
        throw new Error(errorMsg);
      }

      const lastStep = result.stepResults.filter((r) => r.ok).pop();

      let reply = '';
      if (lastStep?.data) {
        reply = typeof lastStep.data === 'string' ? lastStep.data : JSON.stringify(lastStep.data);
      }

      if (reply && !lastStep?.streaming) {
        this.bus.emit('chunk', reply);
      }
      const fileAttachment = (lastStep as any)?.fileAttachment;

      if (fileAttachment) {
        this.bus.emit('fileAttachment', fileAttachment);
      }

      this.bus.emit('contextUpdate', { ...this.session.context });

      return reply;
    } finally {
      this.processing = false;
      this.abortController = undefined;
    }
  }

  async resetSession(): Promise<void> {
    if (this.processing) {
      throw new Error('Cannot reset while processing');
    }
    this.session = { started: false, context: {} };
    this.bus.clear();
  }
}
