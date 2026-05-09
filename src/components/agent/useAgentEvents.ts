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
  events?: AgentEvents;
}

export const useAgentEvents = ({ agent, events }: AgentEventsHookOptions) => {
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!agent) {
      return;
    }

    const h =
      (type: keyof AgentEvents) =>
      (...args: any[]) => {
        eventsRef.current?.[type]?.(args[0] as any);
      };

    const u1 = agent.onChunk(h('onChunk'));
    const u2 = agent.onReasoningChunk(h('onReasoningChunk'));
    const u3 = agent.onReasoningComplete(h('onReasoningComplete'));
    const u4 = agent.onThinkingStart(h('onThinkingStart'));
    const u5 = agent.onThinkingEnd(h('onThinkingEnd'));

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [agent]);
};
