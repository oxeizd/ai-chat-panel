import { ResolvedReasoningConfig } from '../../config/types';
import { extractValueByPath } from '../../../shared/utils/objectHelpers';

export interface ExtractReasoningResult {
  reasoningText?: string;
  cleanReply: string;
}

export function extractReasoning(
  data: any,
  replyText: string | undefined,
  config: ResolvedReasoningConfig | null
): ExtractReasoningResult {
  const originalReply = replyText ?? '';
  if (!config || config.format !== 'embedded') {
    return { cleanReply: originalReply };
  }

  const { mode, apiField, startMarker, endMarker } = config;
  let reasoningText: string | undefined;
  let cleanReply = originalReply;

  if (mode === 'api_field' && apiField) {
    const extracted = extractValueByPath(data, apiField);
    if (typeof extracted === 'string' && extracted.trim()) {
      reasoningText = extracted;
    } else if (Array.isArray(extracted)) {
      const joined = extracted.filter((item) => typeof item === 'string').join('\n');
      if (joined) {
        reasoningText = joined;
      }
    }
  }

  if (mode === 'thinking_tags' && startMarker && endMarker && cleanReply) {
    let reasoningFromTags = '';
    let textWithoutTags = cleanReply;
    let startIdx = textWithoutTags.indexOf(startMarker);
    while (startIdx !== -1) {
      const endIdx = textWithoutTags.indexOf(endMarker, startIdx + startMarker.length);
      if (endIdx !== -1) {
        reasoningFromTags +=
          (reasoningFromTags ? '\n' : '') + textWithoutTags.substring(startIdx + startMarker.length, endIdx);
        textWithoutTags = textWithoutTags.substring(0, startIdx) + textWithoutTags.substring(endIdx + endMarker.length);
        startIdx = textWithoutTags.indexOf(startMarker);
      } else {
        break;
      }
    }
    if (reasoningFromTags) {
      reasoningText = reasoningText ? `${reasoningText}\n${reasoningFromTags}` : reasoningFromTags;
      cleanReply = textWithoutTags;
    }
  }

  return { reasoningText, cleanReply };
}
