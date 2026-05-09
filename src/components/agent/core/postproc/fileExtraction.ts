import { PostProcessingMiddleware } from './types';
import { EndpointConfig } from '../../shared/types';
import { WorkflowContext } from '../context';
import { ProcessedResponse } from '../response';
import { parseFileFromResponse } from 'components/agent/shared/utils/fileHandler';

/**
 * Мидлвара: извлекает файл из ответа и сохраняет в контекст.
 */
export class FileExtractionMiddleware implements PostProcessingMiddleware {
  name = 'file-extract';

  process(resp: ProcessedResponse, ep: EndpointConfig, ctx: WorkflowContext) {
    const file = parseFileFromResponse(resp.data);
    if (file) {
      resp.data.fileAttachment = file;
      ctx.fileAttachment = file;
    }
  }
}
