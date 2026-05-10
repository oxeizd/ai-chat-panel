import { ResolvedEndpointConfig } from '../../config/types';
import { HttpResponse } from '../../execution/httpClient';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from './response';
import { extractReply } from 'components/agent/shared/utils/httpHelpers';
import { extractReasoning } from '../helpers/reasoning';

export class JsonHandler implements ResponseHandler {
  canHandle(resolved: ResolvedEndpointConfig, _res: HttpResponse): boolean {
    return resolved.streaming === null;
  }

  async handle(resolved: ResolvedEndpointConfig, res: HttpResponse, opt: HandlerOptions): Promise<ProcessedResponse> {
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

    // Извлечение текста ответа с помощью существующей утилиты
    // TODO: позже заменим на replyPaths, пока оставляем replyField
    const { replyText } = extractReply(data, resolved.replyField);
    
    // Извлечение reasoning и очистка основного текста от тегов мышления
    const { reasoningText, cleanReply } = extractReasoning(
      data,
      replyText,
      resolved.reasoning,
      opt.eventBus
    );
    
    const finalReply = (cleanReply && cleanReply.trim().length > 0) ? cleanReply : (replyText || '');
    const finalData = { ...data, reply: finalReply, thinking: reasoningText };
    
    return {
      data: finalData,
      replyText: finalReply,
      reasoningText,
    };
  }
}