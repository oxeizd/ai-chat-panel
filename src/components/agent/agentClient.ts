import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { resolveObject, VariableContext } from './utils/variableResolver';
import { executeEndpoint, WorkflowContext, executeWorkflow } from './executionEngine';

export class AgentClient {
  private config: AgentConfig;
  private context: WorkflowContext = {};
  private initialized = false;
  private isProcessing = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public async resetSession(): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Cannot reset session while processing a message');
    }
    this.context = {};
    this.initialized = false;
    if (this.config.startupOperation && this.config.endpoints) {
      const endpoint = this.config.endpoints.find((ep) => ep.operation === this.config.startupOperation);
      if (endpoint) {
        await this.runEndpoint(endpoint, {});
        this.initialized = true;
      }
    }
  }

  private async runEndpoint(
    endpoint: EndpointConfig,
    additionalContext: VariableContext,
    onTrace?: (step: TraceStep) => void,
    onChunk?: (chunk: string) => void
  ): Promise<any> {
    const mergedContext: WorkflowContext = { ...this.context, ...additionalContext };
    const result = await executeEndpoint(
      endpoint,
      mergedContext,
      this.config.api,
      this.config.config,
      this.config.headers,
      onTrace,
      onChunk
    );
    this.context = mergedContext;
    return result;
  }

  public async sendMessage(
    userInput: string,
    additionalContext: VariableContext = {},
    onTrace?: (step: TraceStep) => void,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message. Please wait.');
    }
    this.isProcessing = true;
    try {
      this.context.user_input = userInput;
      Object.assign(this.context, additionalContext);

      if (this.config.startupOperation && !this.initialized) {
        const endpointMap = new Map(this.config.endpoints?.map((ep) => [ep.operation, ep]) ?? []);
        const startupEndpoint = endpointMap.get(this.config.startupOperation);
        if (!startupEndpoint) {
          throw new Error(`Startup operation "${this.config.startupOperation}" not found.`);
        } else {
          await this.runEndpoint(startupEndpoint, {}, onTrace);
          this.initialized = true;
        }
      }

      if (this.config.endpoints?.length && this.config.workflow?.length) {
        const endpointMap = new Map<string, EndpointConfig>(this.config.endpoints.map((ep) => [ep.operation, ep]));
        const steps = this.config.workflow
          .filter((op) => op !== this.config.startupOperation)
          .map((op) => {
            const ep = endpointMap.get(op);
            if (!ep) {
              console.warn(`Operation "${op}" not found in endpoints, skipping`);
              return null;
            }
            return { endpoint: ep };
          })
          .filter((step): step is { endpoint: EndpointConfig } => step !== null);
        if (steps.length === 0) {
          throw new Error('No valid steps in workflow');
        }
        const lastResponse = await executeWorkflow(
          steps,
          this.context,
          this.config.api,
          this.config.config,
          this.config.headers,
          onTrace,
          onChunk
        );
        return lastResponse.reply || lastResponse.result || JSON.stringify(lastResponse);
      }

      let requestBody: any = { message: userInput };
      if (this.config.config) {
        const resolvedConfig = resolveObject(this.config.config, this.context);
        requestBody = { ...requestBody, ...resolvedConfig };
      }
      const headersObj: Record<string, string> = {};
      if (this.config.headers) {
        const resolvedHeaders = resolveObject(this.config.headers, this.context);
        for (const [k, v] of Object.entries(resolvedHeaders)) {
          headersObj[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
      if (!headersObj['Content-Type'] && !headersObj['content-type']) {
        headersObj['Content-Type'] = 'application/json';
      }
      if (onTrace) {
        onTrace({
          type: 'request',
          timestamp: Date.now(),
          url: this.config.api,
          method: 'POST',
          requestBody,
        });
      }
      const response = await fetch(this.config.api, {
        method: 'POST',
        headers: headersObj,
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          errorText = 'Unable to read error body';
        }
        if (onTrace) {
          onTrace({
            type: 'response',
            timestamp: Date.now(),
            responseStatus: response.status,
            responseBody: errorText,
          });
        }
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      const responseData = await response.json();
      if (onTrace) {
        onTrace({
          type: 'response',
          timestamp: Date.now(),
          responseStatus: response.status,
          responseBody: responseData,
        });
      }
      return responseData.reply || responseData.result || 'Ответ не получен';
    } finally {
      this.isProcessing = false;
    }
  }
}
