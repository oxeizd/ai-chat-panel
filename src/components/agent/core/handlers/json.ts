import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { HttpResponse } from '../httpClient';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from '../response';
import { isStreamingEnabled, detectSSEByContent } from '../../shared/utils/streaming';
import { getReasoningConfig } from '../../shared/utils/reasoning';
import { extractReply } from '../../shared/utils/httpHelpers';

/**
 * Обработчик обычных JSON-ответов.
 * Поддерживает извлечение мыслей (reasoning) согласно конфигурации endpoint.
 */
export class JsonHandler implements ResponseHandler {
  canHandle(ep: EndpointConfig, res: HttpResponse): boolean {
    return !detectSSEByContent(res as any) && !isStreamingEnabled(ep);
  }

  async handle(
    res: HttpResponse,
    ep: EndpointConfig,
    ctx: WorkflowContext,
    opt: HandlerOptions
  ): Promise<ProcessedResponse> {
    const data = await res.json();

    if (data?.error) {
      const err: any = new Error(data.error.message || 'API error');
      err.status = data.error.code || data.error.status || res.status;
      err.responseBody = JSON.stringify(data.error);
      throw err;
    }

    opt.onTrace?.({
      type: 'response',
      timestamp: Date.now(),
      responseStatus: res.status,
      responseBody: data,
    });

    // ─── Извлечение replyText ───
    const { replyText } = extractReply(data, ep.replyField);

    // ─── Конфиг reasoning ───
    const reasoningCfg = getReasoningConfig(ep);
    const reasoningEnabled = reasoningCfg.enabled;
    const mode = reasoningCfg.mode ?? 'both';
    const useApiField = mode === 'api_field' || mode === 'both';
    const useThinkingTags = mode === 'thinking_tags' || mode === 'both';

    let reasoningText: string | undefined = undefined;
    let cleanReply: string | undefined = undefined; // для очищенного текста после тегов

    // ─── Извлечение reasoning ───
    if (reasoningEnabled && replyText) {
      // 1. Из API поля
      if (useApiField) {
        const msg = data.choices?.[0]?.message;
        if (msg?.reasoning) {
          reasoningText = msg.reasoning;
        } else if (msg?.reasoning_details) {
          reasoningText = msg.reasoning_details
            .filter((d: any) => d.text)
            .map((d: any) => d.text)
            .join('\n');
        } else if (data.reasoning) {
          reasoningText = data.reasoning;
        }
      }

      // 2. Из thinking тегов
      if (useThinkingTags) {
        const startMarker = reasoningCfg.startMarker ?? '<thinking>';
        const endMarker = reasoningCfg.endMarker ?? '</thinking>';

        let tagReasoning = '';
        cleanReply = replyText;

        let startIdx = cleanReply.indexOf(startMarker);
        while (startIdx !== -1) {
          const endIdx = cleanReply.indexOf(endMarker, startIdx + startMarker.length);
          if (endIdx !== -1) {
            const inside = cleanReply.substring(startIdx + startMarker.length, endIdx);
            tagReasoning += (tagReasoning ? '\n' : '') + inside;
            cleanReply = cleanReply.substring(0, startIdx) + cleanReply.substring(endIdx + endMarker.length);
            startIdx = cleanReply.indexOf(startMarker);
          } else {
            break;
          }
        }

        if (tagReasoning) {
          reasoningText = reasoningText ? reasoningText + '\n' + tagReasoning : tagReasoning;
          data.reply = cleanReply; // обновляем data.reply очищенным текстом
        }
      }

      // 3. Эмитим события, если reasoning найден
      if (reasoningText) {
        opt.eventBus.emit('thinkingStart', {});
        opt.eventBus.emit('reasoningComplete', reasoningText);
        opt.eventBus.emit('thinkingEnd', {});
      }
    }

    return {
      data: { ...data, reply: cleanReply ?? replyText, thinking: reasoningText },
      replyText: cleanReply ?? replyText,
      reasoningText,
    };
  }
}
