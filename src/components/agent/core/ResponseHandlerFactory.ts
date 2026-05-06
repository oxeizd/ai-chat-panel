import { IResponseHandler } from '../interfaces/IResponseHandler';
import { EndpointConfig } from 'types';
import { HttpResponse } from '../interfaces/IHttpClient';
import { JsonHandler } from './handlers/JsonHandler';
import { SseHandler } from './handlers/SseHandler';

/**
 * Фабрика, выбирающая подходящий обработчик ответа на основе конфигурации эндпоинта и заголовков ответа.
 */
export class ResponseHandlerFactory {
  private handlers: IResponseHandler[] = [];

  constructor() {
    // Обработчики в порядке приоритета: сначала SSE, потом JSON
    this.handlers.push(new SseHandler());
    this.handlers.push(new JsonHandler());
  }

  /**
   * Регистрирует новый обработчик в начало очереди.
   * @param handler - обработчик
   */
  registerHandler(handler: IResponseHandler): void {
    this.handlers.unshift(handler);
  }

  /**
   * Находит первый подходящий обработчик.
   * @returns экземпляр IResponseHandler
   */
  getHandler(endpoint: EndpointConfig, response: HttpResponse): IResponseHandler {
    for (const handler of this.handlers) {
      if (handler.canHandle(endpoint, response)) {
        return handler;
      }
    }
    // Если ни один не подошёл, возвращаем JSON-обработчик как fallback
    return new JsonHandler();
  }
}