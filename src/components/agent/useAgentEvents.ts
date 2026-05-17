import { useEffect } from 'react';

interface AgentEventsCallbacks {
  onChunk?: (chunk: string) => void;
  onReasoningStart?: (payload?: { title?: string }) => void;
  onReasoningChunk?: (chunk: string) => void;
  onReasoningEnd?: (text: string) => void;
  onContextUpdate?: (ctx: Record<string, any>) => void;
  onFileAttachment?: (file: any) => void;
}

interface UseAgentEventsOptions {
  subscriptions: {
    onChunk?: (handler: (chunk: string) => void) => () => void;
    onReasoningStart?: (handler: (payload?: { title?: string }) => void) => () => void;
    onReasoningChunk?: (handler: (chunk: string) => void) => () => void;
    onReasoningEnd?: (handler: (text: string) => void) => () => void;
    onContextUpdate?: (handler: (ctx: Record<string, any>) => void) => () => void;
    onFileAttachment?: (handler: (file: any) => void) => () => void;
  } | null;
  callbacksRef: React.MutableRefObject<AgentEventsCallbacks>;
}

export const useAgentEvents = ({ subscriptions, callbacksRef }: UseAgentEventsOptions) => {
  useEffect(() => {
    if (!subscriptions) {
      return;
    }

    const unsubFunctions: Array<() => void> = [];

    if (subscriptions.onChunk) {
      unsubFunctions.push(
        subscriptions.onChunk((chunk) => {
          callbacksRef.current.onChunk?.(chunk);
        })
      );
    }

    if (subscriptions.onReasoningStart) {
      unsubFunctions.push(
        subscriptions.onReasoningStart((payload) => {
          callbacksRef.current.onReasoningStart?.(payload);
        })
      );
    }

    if (subscriptions.onReasoningChunk) {
      unsubFunctions.push(
        subscriptions.onReasoningChunk((chunk) => {
          callbacksRef.current.onReasoningChunk?.(chunk);
        })
      );
    }

    if (subscriptions.onReasoningEnd) {
      unsubFunctions.push(
        subscriptions.onReasoningEnd((text) => {
          callbacksRef.current.onReasoningEnd?.(text);
        })
      );
    }

    if (subscriptions.onContextUpdate) {
      unsubFunctions.push(
        subscriptions.onContextUpdate((ctx) => {
          callbacksRef.current.onContextUpdate?.(ctx);
        })
      );
    }

    if (subscriptions.onFileAttachment) {
      unsubFunctions.push(
        subscriptions.onFileAttachment((file) => {
          callbacksRef.current.onFileAttachment?.(file);
        })
      );
    }

    return () => {
      unsubFunctions.forEach((unsub) => unsub());
    };
  }, [subscriptions, callbacksRef]);
};
