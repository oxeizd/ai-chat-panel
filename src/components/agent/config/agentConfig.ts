import { AgentConfig, ChatHistoryConfig, EndpointConfig, PollingConfig, ReasoningConfig, StreamingConfig } from 'types';

// ---------------- Defaults ----------------
const DEFAULT_POLLING_FALSE: PollingConfig = { enabled: false };
const DEFAULT_REASONING_FALSE: ReasoningConfig = { enabled: false };
const DEFAULT_STREAMING_FALSE: StreamingConfig = { enabled: false };
const DEFAULT_HISTORY_FALSE: ChatHistoryConfig = { enabled: false };

export const DEFAULT_ENDPOINT_CONFIG: Partial<EndpointConfig> = {
  headers: null,
  body: null,
  saveToContext: [],
  polling: DEFAULT_POLLING_FALSE,
  streaming: DEFAULT_STREAMING_FALSE,
  historyConfig: DEFAULT_HISTORY_FALSE,
  reasoning: DEFAULT_REASONING_FALSE,
};

// ---------------- Helpers ----------------
function isObject(v: unknown): v is Record<string, any> {
  return v !== null && typeof v === 'object';
}

// ---------------- Simple runtime validation ----------------
type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateEndpointConfig(input: unknown): ValidationResult<EndpointConfig> {
  if (!isObject(input)) {
    return { ok: false, error: 'endpoint must be an object' };
  }
  const cfg = input as Record<string, any>;
  if (typeof cfg.operation !== 'string') {
    return { ok: false, error: 'operation required string' };
  }
  if (typeof cfg.method !== 'string') {
    return { ok: false, error: 'method required string' };
  }
  if (typeof cfg.path !== 'string') {
    return { ok: false, error: 'path required string' };
  }

  if ('polling' in cfg && cfg.polling !== undefined) {
    const p = cfg.polling;
    if (!isObject(p) || typeof p.enabled !== 'boolean') {
      return { ok: false, error: 'polling.enabled must be boolean' };
    }
  }

  if ('streaming' in cfg && cfg.streaming !== undefined) {
    const s = cfg.streaming;
    if (!isObject(s) || typeof s.enabled !== 'boolean') {
      return { ok: false, error: 'streaming.enabled must be boolean' };
    }
    if (s.enabled && typeof s.parseStrategy !== 'string') {
      return { ok: false, error: 'streaming.parseStrategy required when enabled' };
    }
  }

  if ('conversationHistory' in cfg && cfg.conversationHistory !== undefined) {
    const h = cfg.conversationHistory;
    if (!isObject(h) || typeof h.enabled !== 'boolean') {
      return { ok: false, error: 'conversationHistory.enabled must be boolean' };
    }
    if (h.enabled && h.mode === 'incoming_sync') {
      if (
        !isObject(h.historySync) ||
        typeof h.historySync.eventType !== 'string' ||
        typeof h.historySync.messagesPath !== 'string'
      ) {
        return { ok: false, error: 'conversationHistory.historySync requires eventType and messagesPath strings' };
      }
    }
  }

  if ('reasoning' in cfg && cfg.reasoning !== undefined) {
    const r = cfg.reasoning;
    if (!isObject(r) || typeof r.enabled !== 'boolean') {
      return { ok: false, error: 'reasoning.enabled must be boolean' };
    }
    if (r.enabled) {
      if (r.type === 'embedded') {
        if (r.mode === 'api_field' && typeof r.apiField !== 'string') {
          return { ok: false, error: 'reasoning.apiField required for mode api_field' };
        }
        if (r.mode === 'thinking_tags' && typeof r.textPath !== 'string') {
          return { ok: false, error: 'reasoning.textPath required for mode thinking_tags' };
        }
      } else if (r.type !== 'separate') {
        return { ok: false, error: 'reasoning.type must be "embedded" or "separate" when enabled' };
      }
    }
  }

  return { ok: true, value: cfg as EndpointConfig };
}

export function validateAgentConfig(input: unknown): ValidationResult<AgentConfig> {
  if (!isObject(input)) {
    return { ok: false, error: 'agent must be an object' };
  }

  const a = input as Record<string, any>;

  if (typeof a.name !== 'string') {
    return { ok: false, error: 'agent.name required string' };
  }

  if (typeof a.url !== 'string') {
    return { ok: false, error: 'agent.url required string' };
  }

  if (!Array.isArray(a.endpoints)) {
    return { ok: false, error: 'agent.endpoints required array' };
  }

  for (const ep of a.endpoints) {
    const v = validateEndpointConfig(ep);
    if (!v.ok) {
      return { ok: false, error: `endpoint validation failed: ${v.error}` };
    }
  }
  return { ok: true, value: a as AgentConfig };
}

// ---------------- Normalization / creation ----------------
export function normalizeEndpointConfig(input: Partial<EndpointConfig>, baseUrl?: string): EndpointConfig {
  const merged: EndpointConfig = {
    operation: input.operation ?? '',
    method: input.method ?? 'POST',
    path: input.path ?? '/',
    headers: input.headers ?? null,
    body: input.body ?? null,
    saveToContext: input.saveToContext ?? [],
    replyField: input.replyField,
    polling: input.polling ?? DEFAULT_POLLING_FALSE,
    streaming: input.streaming ?? DEFAULT_STREAMING_FALSE,
    historyConfig: input.historyConfig ?? DEFAULT_HISTORY_FALSE,
    reasoning: input.reasoning ?? DEFAULT_REASONING_FALSE,
    url: baseUrl ?? '',
  };

  return merged;
}

export function normalizeAgentConfig(input: Partial<AgentConfig>): AgentConfig {
  const agent: AgentConfig = {
    name: input.name ?? 'unnamed',
    url: input.url ?? '',
    default: input.default ?? false,
    endpoints: (input.endpoints ?? []).map((ep) => normalizeEndpointConfig(ep, input.url)),
    workflow: input.workflow ?? [],
    startupOperation: input.startupOperation ?? '',
  };
  console.log(agent);
  return agent;
}

export function createAgentConfig(input: unknown): AgentConfig {
  const v = validateAgentConfig(input);
  if (!v.ok) {
    throw new Error('Invalid AgentConfig: ' + v.error);
  }
  return normalizeAgentConfig(v.value as Partial<AgentConfig>);
}
