import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentConfig } from 'types';
import { GrafanaUser } from 'components/hooks/useGrafanaUser';
import { useMessageSender } from './useMessageSender';
import { useMessagesState } from './useMessagesState';
import { useDebugTraces } from 'components/ui/debug/hooks/useDebugTraces';
import { parseApiError } from '../../debug/hooks/utils/errorParser';

export const useChatMessages = (currentAgent: AgentConfig | null, user: GrafanaUser | null, debug: boolean) => {
  const resettingRef = useRef(false);
  const [inputValue, setInputValue] = useState('');

  const {
    messages,
    addUserMessage,
    setMessages,
    addAssistantPlaceholder,
    updateAssistantText,
    updateAssistantThinking,
    setAssistantThinkingDone,
    setAssistantFinal,
    removeAssistant,
    addErrorAsAi,
    markUserError,
    pruneFrom,
    resetMessages,
  } = useMessagesState();

  const { traces, create, addStep, setReply, setError, remove: removeTrace } = useDebugTraces(debug);
  const { send, abort, reset: resetSession, isSending, getThreadId } = useMessageSender({ agent: currentAgent, user });
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  const sendText = useCallback(
    async (text: string, options?: { replaceUserMessageId?: string }): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || !currentAgent || isSending) {
        return false;
      }

      let userMessageId: string;
      if (options?.replaceUserMessageId) {
        const index = messages.findIndex((m) => m.id === options.replaceUserMessageId);
        if (index === -1) {
          return false;
        }
        pruneFrom(index);
        const newUserMsg = addUserMessage(trimmed);
        userMessageId = newUserMsg.id;
        removeTrace(options.replaceUserMessageId);
      } else {
        const newUserMsg = addUserMessage(trimmed);
        userMessageId = newUserMsg.id;
      }

      const assistantPlaceholder = addAssistantPlaceholder();
      const assistantId = assistantPlaceholder.id;
      const trace = create(userMessageId, trimmed);

      try {
        const reply = await send(trimmed, {
          onChunk: (chunk: string) => {
            updateAssistantText(assistantId, (prev) => prev + chunk);
          },
          onReasoningChunk: (chunk: string) => {
            updateAssistantThinking(assistantId, chunk);
          },
          onReasoningComplete: (full: string) => {
            setAssistantThinkingDone(assistantId, full);
          },
          onStep: (step: any) => {
            if (trace) {
              addStep(userMessageId, step);
            }
          },
        });

        const newThreadId = getThreadId();
        if (newThreadId) {
          setThreadId(newThreadId);
        }

        if (reply === null) {
          removeAssistant(assistantId);
          return false;
        }

        setAssistantFinal(assistantId, reply);
        if (trace) {
          setReply(userMessageId, reply);
        }
        return true;
      } catch (err) {
        removeAssistant(assistantId);
        const parsed = parseApiError(err);
        if (trace) {
          setError(userMessageId, parsed);
        }
        markUserError(userMessageId, parsed);
        addErrorAsAi(parsed.message, parsed);
        return false;
      }
    },
    [
      addStep,
      currentAgent,
      isSending,
      messages,
      pruneFrom,
      addUserMessage,
      removeTrace,
      addAssistantPlaceholder,
      create,
      updateAssistantText,
      updateAssistantThinking,
      setAssistantThinkingDone,
      send,
      removeAssistant,
      setAssistantFinal,
      setReply,
      markUserError,
      addErrorAsAi,
      setError,
      getThreadId,
    ]
  );

  const sendMessage = useCallback(
    (customText?: string) => {
      const text = customText !== undefined ? customText : inputValue;
      if (text.trim()) {
        sendText(text);
        if (customText === undefined) {
          setInputValue('');
        }
      }
    },
    [inputValue, sendText]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isSending) {
        return;
      }

      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1 || messages[index].sender !== 'user') {
        return;
      }
      const originalText = messages[index].text;
      await sendText(originalText, { replaceUserMessageId: messageId });
    },
    [messages, sendText, isSending]
  );

  const newChat = useCallback(async () => {
    if (resettingRef.current) {
      return;
    }
    resettingRef.current = true;
    try {
      abort();
      resetMessages();
      setInputValue('');
      setThreadId(null);
      try {
        await resetSession();
      } catch (err) {
        console.warn('Failed to reset session on backend', err);
      }
    } finally {
      resettingRef.current = false;
    }
  }, [abort, resetMessages, resetSession]);

  const clearChat = useCallback(() => {
    abort();
    resetMessages();
  }, [abort, resetMessages]);

  const getTrace = useCallback((messageId: string) => traces.get(messageId), [traces]);

  return {
    messages,
    isLoading: isSending,
    inputValue,
    setMessages,
    setInputValue,
    sendMessage,
    clearChat,
    newChat,
    retryMessage,
    traces,
    getTrace,
    threadId,
  };
};
