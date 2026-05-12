import { ResolvedEndpointConfig } from '../../config/types';
import { HttpResponse } from '../../execution/httpClient';
import { EventBus } from '../../events/eventBus';
import { TraceStep } from 'types';

export interface HandlerOptions {
  eventBus: EventBus;
  onTrace?: (step: TraceStep) => void;
  signal?: AbortSignal;
}

export interface ProcessedResponse {
  data: any;
  replyText?: string;
  reasoningText?: string;
  rawText?: string;
  rawEvents?: any[];
  historySynced?: boolean;
}

export interface ResponseHandler {
  canHandle(resolved: ResolvedEndpointConfig, response: HttpResponse): boolean;
  handle(resolved: ResolvedEndpointConfig, response: HttpResponse, options: HandlerOptions): Promise<ProcessedResponse>;
}

export class HandlerRegistry {
  private handlers: ResponseHandler[];

  constructor(handlers: ResponseHandler[] = []) {
    this.handlers = handlers;
  }

  register(handler: ResponseHandler): void {
    this.handlers.unshift(handler);
  }

  get(resolved: ResolvedEndpointConfig, response: HttpResponse): ResponseHandler {
    const handler = this.handlers.find((h) => h.canHandle(resolved, response));
    if (!handler) {
      throw new Error('No suitable handler found. Register JsonHandler and SseHandler.');
    }
    return handler;
  }
}
