import { AgentConfig, InteractivePayload, Session, TraceStep } from '../config/types';
import { EventBus } from './eventBus';
import { sendOperation } from '../transport/sender';

export async function executeWorkflow(
  agent: AgentConfig,
  session: Session,
  eventBus: EventBus,
  opts?: {
    abortOnError?: boolean;
    onTrace?: (step: TraceStep) => void;
    signal?: AbortSignal;
  }
) {
  const signal = opts?.signal;
  const onTrace = opts?.onTrace;
  const abortOnError = opts?.abortOnError ?? true;

  const stepResults: Array<{
    operation: string;
    ok: boolean;
    data?: any;
    error?: string;
    streaming?: boolean;
    fileAttachment?: any;
    interactive?: InteractivePayload;
  }> = [];

  const ops: string[] = [];

  const threadIdContextKey = agent.threadIdContextKey || 'thread_id';

  const hasRestoredHistory = Array.isArray(session.context.__history) && session.context.__history.length > 0;

  const hasRestoredThreadId = Boolean(session.context[threadIdContextKey]);

  const isRestoredChat = hasRestoredHistory || hasRestoredThreadId;

  /**
   * startupOperation запускается исключительно у нового чата.
   *
   * Для загруженной истории:
   * - session.started уже true через markSessionStarted();
   * - а также в context есть __history и/или thread ID.
   *
   * Вторая проверка — дополнительная защита от повторного startup.
   */
  if (!session.started && !isRestoredChat && agent.startupOperation) {
    ops.push(agent.startupOperation);
  }

  if (agent.workflow?.length) {
    ops.push(...agent.workflow);
  }

  for (const operation of ops) {
    const result = await sendOperation(agent, operation, session.context, eventBus, {
      onTrace,
      signal,
    });

    if (!result.ok) {
      stepResults.push({
        operation,
        ok: false,
        error: result.error,
      });

      if (abortOnError) {
        return {
          success: false,
          stepResults,
          context: session.context,
        };
      }
    } else {
      session.context = {
        ...session.context,
        ...(result.context ?? {}),
      };

      stepResults.push({
        operation,
        ok: true,
        data: result.data,
        streaming: result.isStreaming ?? false,
        fileAttachment: result.fileAttachment,
        interactive: result.interactive,
      });
    }

    if (!session.started) {
      session.started = true;
    }
  }

  return {
    success: stepResults.every((step) => step.ok),
    stepResults,
    context: session.context,
  };
}
