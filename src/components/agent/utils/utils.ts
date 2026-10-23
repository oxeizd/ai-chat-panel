import { HttpResponse } from 'types';
import { resolveString } from './templating';

export function safeParseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function applySaveToContext(context: Record<string, any>, saves: string[] | undefined, source: any) {
  if (!saves || !Array.isArray(saves)) {
    return;
  }

  for (const path of saves) {
    const v = dotGet(source, path);
    if (v !== undefined) {
      dotSet(context, path, v);
    }
  }
}

export async function parseHttpResponse(res: HttpResponse, replyField?: string): Promise<{ body: any; reply: any }> {
  const ct = (res.headers?.get?.('content-type') ?? '') as string;
  let parsedBody: any;
  if (ct.includes('application/json')) {
    parsedBody = await res.json();
  } else {
    const txt = await res.text();
    parsedBody = safeParseJson(txt);
  }
  const reply =
    replyField && parsedBody && typeof parsedBody === 'object' ? dotGet(parsedBody, replyField) : parsedBody;
  return { body: parsedBody, reply };
}

/**
 * Разбивает dot-path на сегменты, поддерживая и точечную нотацию,
 * и скобочную для чисел и строк: `choices[0].delta.content`,
 * `custom.charts["parabola"].data`.
 */
function splitPath(path: string): string[] {
  const parts: string[] = [];
  const re = /\.\.?|\[[^\]]*\]|[^.[\]]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    const token = m[0];
    if (token === '.' || token === '') {
      continue;
    }
    if (token.startsWith('[') && token.endsWith(']')) {
      let key = token.slice(1, -1).trim();
      if (
        (key.startsWith('"') && key.endsWith('"') && key.length >= 2) ||
        (key.startsWith("'") && key.endsWith("'") && key.length >= 2)
      ) {
        key = key.slice(1, -1);
      }
      parts.push(key);
    } else {
      parts.push(token);
    }
  }
  return parts;
}

export function dotGet(obj: any, path?: string) {
  if (!path || obj == null) {
    return undefined;
  }

  let cur = obj;
  for (const p of splitPath(path)) {
    if (cur == null) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

export function dotSet(obj: Record<string, any>, path: string, value: any) {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  let cur: any = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) {
      cur[p] = value;
    } else {
      if (cur[p] == null) {
        cur[p] = {};
      }
      cur = cur[p];
    }
  }
}

export function buildEndpointUrl(baseUrl: string, endpointPath: string, context: Record<string, any>): string {
  let resolvedBaseUrl = baseUrl;

  if (!resolvedBaseUrl) {
    resolvedBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (resolvedBaseUrl.startsWith('/')) {
    resolvedBaseUrl = (typeof window !== 'undefined' ? window.location.origin : '') + resolvedBaseUrl;
  }

  const path = resolveString(endpointPath, context);

  const combine = (base: string, relative: string) => {
    if (!relative) {
      return base;
    }

    const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
    const relativeClean = relative.startsWith('/') ? relative : '/' + relative;

    return baseClean + relativeClean;
  };

  return combine(resolvedBaseUrl, path);
}
