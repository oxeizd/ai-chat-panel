import { IPostProcessingMiddleware } from '../../interfaces/IPostProcessingMiddleware';
import { EndpointConfig } from 'types';
import { WorkflowContext } from '../../core/ContextManager';
import { ProcessedResponse } from '../../interfaces/IResponseHandler';
import { parseFileFromResponse } from '../../utils/fileHandler';

/**
 * Middleware, извлекающий файл из ответа и сохраняющий его в контекст и в data.
 */
export class FileExtractionMiddleware implements IPostProcessingMiddleware {
  name = 'FileExtractionMiddleware';

  process(
    response: ProcessedResponse,
    endpoint: EndpointConfig,
    context: WorkflowContext
  ): void {
    const fileAttachment = parseFileFromResponse(response.data);
    if (fileAttachment) {
      response.data.fileAttachment = fileAttachment; // чтобы было доступно в reply
      context.fileAttachment = fileAttachment;
    }
  }
}