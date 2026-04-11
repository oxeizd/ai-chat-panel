import { WorkflowContext } from '../executionEngine';
import { mergeObjects } from './objectHelpers';
import { resolveString, resolveObject } from './variableResolver';

export const buildUrl = (endpoint: { path: string }, context: WorkflowContext, baseUrl: string): string => {
  let resolvedBaseUrl = baseUrl;
  if (!resolvedBaseUrl) {
    resolvedBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  } else if (resolvedBaseUrl.startsWith('/')) {
    resolvedBaseUrl = (typeof window !== 'undefined' ? window.location.origin : '') + resolvedBaseUrl;
  }
  const path = resolveString(endpoint.path, context);
  const combine = (base: string, relative: string) => {
    if (!relative) {
      return base;
    }
    const baseClean = base.endsWith('/') ? base.slice(0, -1) : base;
    const relativeClean = relative.startsWith('/') ? relative : '/' + relative;
    return baseClean + relativeClean;
  };
  return combine(resolvedBaseUrl, path);
};

export const buildRequestBody = (
  endpoint: { body?: any },
  context: WorkflowContext,
  agentConfig?: Record<string, any>
): { mergedBody: any; bodyString?: string } => {
  const resolvedAgentConfig = agentConfig ? resolveObject(agentConfig, context) : {};
  const resolvedEndpointBody = endpoint.body ? resolveObject(endpoint.body, context) : {};
  const mergedBody = mergeObjects(resolvedAgentConfig, resolvedEndpointBody);
  let bodyString: string | undefined = undefined;
  if (Object.keys(mergedBody).length > 0) {
    bodyString = JSON.stringify(mergedBody);
  }
  return { mergedBody, bodyString };
};

export const extractReply = (data: any, replyField?: string): { replyText?: string; dataWithReply: any } => {
  let replyText: string | undefined;
  if (replyField) {
    const replyValue = data[replyField];
    if (replyValue !== undefined) {
      replyText = String(replyValue);
    }
  } else {
    if (data.choices?.[0]?.message?.content) {
      replyText = data.choices[0].message.content;
    } else if (data.choices?.[0]?.delta?.content) {
      replyText = data.choices[0].delta.content;
    } else if (data.reply !== undefined) {
      replyText = String(data.reply);
    } else if (data.result !== undefined) {
      replyText = String(data.result);
    }
  }
  if (replyText !== undefined) {
    data.reply = replyText;
  }
  return { replyText, dataWithReply: data };
};

export const saveToContext = (
  endpoint: { saveToContext?: string[] },
  context: WorkflowContext,
  data: Record<string, any>,
  additionalExcludes: string[] = []
): void => {
  const exclude = new Set([...additionalExcludes, 'messages']);
  if (endpoint.saveToContext?.length) {
    for (const key of endpoint.saveToContext) {
      if (data[key] !== undefined && !exclude.has(key)) {
        context[key] = data[key];
      }
    }
  } else {
    for (const [key, value] of Object.entries(data)) {
      if (!exclude.has(key)) {
        context[key] = value;
      }
    }
  }
};
