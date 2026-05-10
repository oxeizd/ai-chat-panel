import { buildUrl } from 'components/agent/shared/utils/httpHelpers';
import { resolveObject } from 'components/agent/shared/utils/variableResolver';
import { AgentConfig, EndpointConfig } from 'types';
import { WorkflowContext } from '../execution/contextManager';
import { STREAMING_DEFAULTS, POLLING_DEFAULTS, REASONING_DEFAULTS } from '../../shared/constants';
import {
  ResolvedEndpointConfig,
  ResolvedStreamingConfig,
  ResolvedPollingConfig,
  ResolvedReasoningConfig,
  ResolvedConversationHistoryConfig,
} from './types';

function resolveReasoning(raw: EndpointConfig): ResolvedReasoningConfig | null {
  const r = raw.reasoning;

  if (r == null || r === false) {
    return null;
  }

  if (r === true) {
    return { enabled: true, ...REASONING_DEFAULTS };
  }

  if (r.enabled === false) {
    return null;
  }

  return {
    enabled: true,
    mode: r.mode ?? REASONING_DEFAULTS.mode,
    apiField: r.apiField ?? REASONING_DEFAULTS.apiField,
    textPath: r.textPath ?? REASONING_DEFAULTS.textPath,
    startMarker: r.startMarker ?? REASONING_DEFAULTS.startMarker,
    endMarker: r.endMarker ?? REASONING_DEFAULTS.endMarker,
  };
}

function resolveStreaming(raw: EndpointConfig): ResolvedStreamingConfig | null {
  const s = raw.streaming;

  if (s == null || s === false) {
    return null;
  }
  if (s === true) {
    return { enabled: true, ...STREAMING_DEFAULTS };
  }
  if (typeof s === 'object' && s.enabled === false) {
    return null;
  }

  return {
    enabled: true,
    textPath: s.textPath ?? STREAMING_DEFAULTS.textPath,
    dataPrefix: s.dataPrefix ?? STREAMING_DEFAULTS.dataPrefix,
    delimiter: s.delimiter ?? STREAMING_DEFAULTS.delimiter,
  };
}

function resolvePolling(raw: EndpointConfig): ResolvedPollingConfig | null {
  const polling = raw.polling;

  if (!polling?.enabled) {
    return null;
  }

  return {
    enabled: true,
    intervalMs: polling.intervalMs ?? POLLING_DEFAULTS.intervalMs,
    maxAttempts: polling.maxAttempts ?? POLLING_DEFAULTS.maxAttempts,
    statusField: polling.statusField ?? POLLING_DEFAULTS.statusField,
    successValue: polling.successValue ?? POLLING_DEFAULTS.successValue,
    resultField: polling.resultField,
    retryStatusCodes: polling.retryStatusCodes ?? [],
  };
}

function resolveConversationHistory(raw: EndpointConfig): ResolvedConversationHistoryConfig | null {
  const ch = raw.conversationHistory;

  if (ch == null || ch === false) {
    return null;
  }
  if (ch === true) {
    return { enabled: true };
  }
  if (typeof ch === 'object' && ch.enabled === false) {
    return null;
  }

  return {
    enabled: true,
    userMessageFields: ch.userMessageFields,
    assistantMessageFields: ch.assistantMessageFields,
    historySync: ch.historySync,
  };
}

export function buildEndpointConfig(
  endpointConfig: EndpointConfig,
  agent: AgentConfig,
  context: WorkflowContext
): ResolvedEndpointConfig {
  const polling = resolvePolling(endpointConfig);
  const reasoning = resolveReasoning(endpointConfig);
  const streaming = resolveStreaming(endpointConfig);
  const conversationHistory = resolveConversationHistory(endpointConfig);

  const url = buildUrl(endpointConfig, context, agent.api);
  const headers = resolveObject(endpointConfig.headers ?? {}, context) as Record<string, string>;
  const body = endpointConfig.body ? resolveObject(endpointConfig.body, context) : {};

  return {
    operation: endpointConfig.operation,
    method: endpointConfig.method,
    url,
    headers,
    body: body,
    saveToContext: endpointConfig.saveToContext ?? [],
    replyField: endpointConfig.replyField,
    reasoning,
    streaming,
    polling,
    conversationHistory,
  };
}
