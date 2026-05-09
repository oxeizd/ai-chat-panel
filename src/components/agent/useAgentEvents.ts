import { useEffect, useRef } from 'react';

interface AgentEvents {
  onChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onReasoningComplete?: (text: string) => void;
  onThinkingStart?: () => void;
  onThinkingEnd?: () => void;
}

interface AgentEventsHookOptions {
  agent: {
    onChunk: (handler: (chunk: string) => void) => () => void;
    onReasoningChunk: (handler: (chunk: string) => void) => () => void;
    onReasoningComplete: (handler: (text: string) => void) => () => void;
    onThinkingStart: (handler: () => void) => () => void;
    onThinkingEnd: (handler: () => void) => () => void;
  } | null;
  events: AgentEvents | React.MutableRefObject<AgentEvents>;
}

export const useAgentEvents = ({ agent, events }: AgentEventsHookOptions) => {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!agent) {
      return;
    }

    const getEvents = (): AgentEvents => {
      const current = eventsRef.current;
      if (current && 'current' in current) {
        return current.current;
      }
      return current as AgentEvents;
    };

    const callIfExists = (type: keyof AgentEvents, ...args: any[]) => {
      const evt = getEvents();
      evt?.[type]?.(args[0] as any);
    };

    const unsub1 = agent.onChunk((chunk) => callIfExists('onChunk', chunk));
    const unsub2 = agent.onReasoningChunk((chunk) => callIfExists('onReasoningChunk', chunk));
    const unsub3 = agent.onReasoningComplete((text) => callIfExists('onReasoningComplete', text));
    const unsub4 = agent.onThinkingStart(() => callIfExists('onThinkingStart'));
    const unsub5 = agent.onThinkingEnd(() => callIfExists('onThinkingEnd'));

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [agent]);
};
