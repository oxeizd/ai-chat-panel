import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { HttpResponse } from '../httpClient';
import { ResponseHandler, ProcessedResponse, HandlerOptions } from '../response';
import { isStreamingEnabled, detectSSEByContent } from '../../shared/utils/streaming';

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

    // Извлекаем reasoning из стандартного поля API
    const msg = data.choices?.[0]?.message;
    let reasoningText: string | undefined;

    if (msg?.reasoning) {
      // Строка с полным текстом рассуждений
      reasoningText = msg.reasoning;
    } else if (msg?.reasoning_details) {
      // Массив объектов, собираем все тексты
      reasoningText = msg.reasoning_details
        .filter((d: any) => d.text)
        .map((d: any) => d.text)
        .join('\n');
    } else if (data.reasoning) {
      // Альтернативное поле верхнего уровня
      reasoningText = data.reasoning;
    }

    if (reasoningText) {
      opt.eventBus.emit('reasoningComplete', reasoningText);
    }

    // Текст ответа — всегда из content
    const replyText = msg?.content || data.reply || data.result;

    return {
      data: { ...data, reply: replyText, thinking: reasoningText },
      replyText,
      reasoningText,
    };
  }
}
