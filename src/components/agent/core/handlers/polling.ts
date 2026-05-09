import { ResponseHandler, ProcessedResponse, HandlerOptions } from '../response';
import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { HttpResponse } from '../httpClient';
import { handlePolling } from '../../shared/utils/polling';

/**
 * Декоратор: добавляет поллинг поверх другого обработчика.
 */
export class PollingHandler implements ResponseHandler {
  constructor(private inner: ResponseHandler) {}

  canHandle(ep: EndpointConfig, res: HttpResponse): boolean {
    return !!ep.polling?.enabled && this.inner.canHandle(ep, res);
  }

  async handle(
    res: HttpResponse,
    ep: EndpointConfig,
    ctx: WorkflowContext,
    opt: HandlerOptions
  ): Promise<ProcessedResponse> {
    const initial = await this.inner.handle(res, ep, ctx, opt);
    if (!ep.polling?.enabled) {
      return initial;
    }

    const meta = opt.requestMeta;
    if (!meta) {
      throw new Error('Polling requires requestMeta in options');
    }

    const data = await handlePolling(
      { ...ep, method: ep.method },
      meta.url,
      meta.headers,
      meta.body,
      initial.data,
      opt.onTrace,
      opt.signal
    );

    return { ...initial, data };
  }
}
