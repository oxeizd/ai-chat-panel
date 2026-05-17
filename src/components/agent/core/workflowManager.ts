import { AgentConfig, Session, TraceStep } from '../config/types';
import { EventBus } from './eventBus';
import { sendOperation } from '../transport/sender';

export async function executeWorkflow(
  agent: AgentConfig,
  session: Session,
  eventBus: EventBus,
  opts?: { abortOnError?: boolean; onTrace?: (step: TraceStep) => void; signal?: AbortSignal }
) {
  const signal = opts?.signal;
  const onTrace = opts?.onTrace;
  const abortOnError = opts?.abortOnError ?? true;
  const stepResults: Array<{ operation: string; ok: boolean; data?: any; error?: string; streaming?: boolean }> = [];

  const ops: string[] = [];
  if (!session.started && agent.startupOperation) {
    ops.push(agent.startupOperation);
  }

  if (agent.workflow?.length) {
    ops.push(...agent.workflow);
  }

  for (const op of ops) {
    const res = await sendOperation(agent, op, session.context, eventBus, { onTrace, signal });

    if (!res.ok) {
      stepResults.push({
        operation: op,
        ok: false,
        error: res.error,
      });

      if (abortOnError) {
        return {
          success: false,
          stepResults,
          context: session.context,
        };
      }
    } else {
      session.context = { ...session.context, ...(res.context ?? {}) };

      stepResults.push({
        operation: op,
        ok: true,
        data: res.data,
        streaming: res.isStreaming ?? false,
      });
    }

    if (!session.started) {
      session.started = true;
    }
  }

  return {
    success: stepResults.every((s) => s.ok),
    stepResults,
    context: session.context,
  };
}
