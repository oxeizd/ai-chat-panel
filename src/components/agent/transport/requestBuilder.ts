import { EndpointConfig, RequestConfig, TraceStep } from 'types';
import { resolveObject, resolveString } from '../utils/templating';
import { buildEndpointUrl } from '../utils/utils';
import { injectHistory, saveUserMessages } from '../core/historyManager';

export function buildRequestConfig(
  ep: EndpointConfig,
  context: Record<string, any>,
  onTrace?: (step: TraceStep) => void
): RequestConfig {
  const url = buildEndpointUrl(ep.url || '', ep.path, context);
  const method = (ep.method ?? 'POST').toUpperCase();
  const headers: Record<string, string> = {};

  for (const [k, v] of Object.entries(ep.headers ?? {})) {
    headers[k] = typeof v === 'string' ? resolveString(v, context) : String(v);
  }

  if (!('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  let body: string | undefined = undefined;

  if (ep.body != null && method !== 'GET' && method !== 'HEAD') {
    if (typeof ep.body === 'string') {
      body = resolveString(ep.body, context);
    } else {
      const bodyStr = resolveObject(ep.body, context);
      body = JSON.stringify(bodyStr);
    }
  }

  if (ep.historyConfig?.enabled && body) {
    const mode = ep.historyConfig.mode;
    const historyField = mode === 'local' ? (ep.historyConfig.historyField ?? 'messages') : 'messages';

    if (mode === 'incoming_sync' && context.__history) {
      try {
        const bodyObj = JSON.parse(body);
        let messages = context.__history.slice();
        const currentMessages = bodyObj[historyField];
        if (Array.isArray(currentMessages)) {
          const newUserMsg = currentMessages.filter((m) => m?.role === 'user').pop();
          if (newUserMsg) {
            messages.push(newUserMsg);
            context.__history = messages;
          }
        }
        bodyObj[historyField] = messages;
        body = JSON.stringify(bodyObj);
      } catch {
        body = injectHistory(body, context, { ...ep.historyConfig, historyField }) as string;
      }
    } else if (mode === 'local') {
      try {
        const bodyObj = JSON.parse(body);
        const messages = bodyObj[historyField];
        if (Array.isArray(messages)) {
          saveUserMessages(context, messages, ep.historyConfig, onTrace);
          body = injectHistory(body, context, ep.historyConfig) as string;
        }
      } catch {}
    }
  }

  return { url, method, headers, body, onTrace };
}
