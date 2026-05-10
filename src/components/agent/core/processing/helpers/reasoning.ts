import { ResolvedReasoningConfig } from '../../config/types';
import { EventBus } from '../../events/eventBus';
import { extractValueByPath } from '../../../shared/utils/objectHelpers';

export interface ExtractReasoningResult {
  reasoningText?: string;
  cleanReply: string;
}

export function extractReasoning(
  data: any,
  replyText: string | undefined,
  config: ResolvedReasoningConfig | null,
  eventBus: EventBus
): ExtractReasoningResult {
  const originalReply = replyText ?? '';
  if (!config) return { cleanReply: originalReply };

  const { mode, apiField, startMarker, endMarker } = config;
  const useApiField = mode === 'api_field' || mode === 'both';
  const useThinkingTags = mode === 'thinking_tags' || mode === 'both';

  let reasoningText: string | undefined;
  let cleanReply = originalReply;

  if (useApiField) {
    const extracted = extractValueByPath(data, apiField);
    if (typeof extracted === 'string' && extracted.trim()) {
      reasoningText = extracted;
    } else if (Array.isArray(extracted)) {
      const joined = extracted.filter(item => typeof item === 'string').join('\n');
      if (joined) reasoningText = joined;
    }
  }

  if (useThinkingTags && cleanReply) {
    let reasoningFromTags = '';
    let textWithoutTags = cleanReply;
    let startIdx = textWithoutTags.indexOf(startMarker);
    while (startIdx !== -1) {
      const endIdx = textWithoutTags.indexOf(endMarker, startIdx + startMarker.length);
      if (endIdx !== -1) {
        reasoningFromTags += (reasoningFromTags ? '\n' : '') + 
          textWithoutTags.substring(startIdx + startMarker.length, endIdx);
        textWithoutTags = textWithoutTags.substring(0, startIdx) + 
          textWithoutTags.substring(endIdx + endMarker.length);
        startIdx = textWithoutTags.indexOf(startMarker);
      } else break;
    }
    if (reasoningFromTags) {
      reasoningText = reasoningText ? `${reasoningText}\n${reasoningFromTags}` : reasoningFromTags;
      cleanReply = textWithoutTags;
    }
  }

  if (reasoningText) {
    eventBus.emit('thinkingStart');
    eventBus.emit('reasoningChunk', reasoningText);
    eventBus.emit('reasoningComplete', reasoningText);
    eventBus.emit('thinkingEnd');
  }

  return { reasoningText, cleanReply };
}