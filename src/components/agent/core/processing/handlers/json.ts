import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../contextManager';
import { HttpResponse } from '../../httpClient';
import { isStreamingEnabled, detectSSEByContent } from '../helpers/streaming';
import { extractReasoning, getReasoningConfig } from '../helpers/reasoning';
import { extractReply } from 'components/agent/shared/utils/httpHelpers';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from './response';

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
      throw Object.assign(new Error(data.error.message ?? 'API error'), {
        status: data.error.code ?? data.error.status ?? res.status,
        responseBody: JSON.stringify(data.error),
      });
    }

    opt.onTrace?.({
      type: 'response',
      timestamp: Date.now(),
      responseStatus: res.status,
      responseBody: data,
    });

    // Извлекаем текст ответа
    const { replyText } = extractReply(data, ep.replyField);

    // Извлекаем reasoning (если включён)
    const reasoningCfg = getReasoningConfig(ep);
    const { reasoningText, cleanReply } = extractReasoning(data, replyText, reasoningCfg, opt.eventBus);

    // Итоговый ответ: если cleanReply есть и не пустая строка, берём её, иначе исходный replyText
    const finalReply = cleanReply && cleanReply.trim().length > 0 ? cleanReply : replyText || '';
    const finalData = { ...data, reply: finalReply, thinking: reasoningText };

    return {
      data: finalData,
      replyText: finalReply,
      reasoningText,
    };
  }
}
