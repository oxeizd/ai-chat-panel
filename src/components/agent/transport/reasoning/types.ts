import { EventBus } from 'components/agent/core/eventBus';
import { ReasoningConfig, TraceStep } from 'types';

export interface ReasoningState {
  active: boolean;
  fullText: string;
}

export interface ReasoningChunkContext {
  parsedChunk: any; // JSON-объект из чанка
  config: ReasoningConfig;
  state: ReasoningState;
  eventBus: EventBus;
  onTrace?: (step: TraceStep) => void;
}

export interface ReasoningExtractContext {
  parsedBody: any; // полный ответ (не стриминг)
  reply: any;
  config: ReasoningConfig;
  eventBus: EventBus;
  onTrace?: (step: TraceStep) => void;
}
