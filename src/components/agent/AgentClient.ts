import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { executeWorkflow, executeEndpoint, WorkflowContext } from './WorkflowExecutor';
import { VariableContext } from './VariableResolver';

export class AgentClient {
  private config: AgentConfig;
  private context: WorkflowContext = {};
  private initialized = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public async resetSession(): Promise<void> {
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
    onTrace?: (step: TraceStep) => void
  ): Promise<any> {
    const combinedContext: WorkflowContext = { ...this.context, ...additionalContext };
    return executeEndpoint(
      endpoint,
      combinedContext,
      this.config.api,
      this.config.config,
      this.config.headers,
      onTrace
    );
  }

  public async sendMessage(
    userInput: string,
    additionalContext: VariableContext = {},
    onTrace?: (step: TraceStep) => void
  ): Promise<string> {
    const context = this.context;
    context.user_input = userInput;
    Object.assign(context, additionalContext);

    if (this.config.endpoints?.length && this.config.workflow?.length) {
      const endpointMap = new Map<string, EndpointConfig>(this.config.endpoints.map((ep) => [ep.operation, ep]));

      const steps = this.config.workflow
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

      if (this.config.startupOperation && !this.initialized) {
        const startupEndpoint = endpointMap.get(this.config.startupOperation);
        if (startupEndpoint) {
          await this.runEndpoint(startupEndpoint, context, onTrace);
          this.initialized = true;
        }
      }

      const lastResponse = await executeWorkflow(
        steps,
        context,
        this.config.api,
        this.config.config,
        this.config.headers,
        onTrace
      );

      if (lastResponse.thread_id) {
        this.context.thread_id = lastResponse.thread_id;
      }
      if (lastResponse.run_id) {
        this.context.run_id = lastResponse.run_id;
      }

      return lastResponse.reply || lastResponse.result || JSON.stringify(lastResponse);
    }

    // Fallback: простой POST
    let requestBody: any = { message: userInput };
    if (this.config.config) {
      try {
        let configStr = this.config.config;
        for (const [key, value] of Object.entries(context)) {
          configStr = configStr.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
        }
        requestBody = { ...requestBody, ...JSON.parse(configStr) };
      } catch (e) {
        console.warn('Invalid agent config JSON, ignoring', e);
      }
    }

    const headersObj: Record<string, string> = {};
    if (this.config.headers) {
      try {
        const parsed = JSON.parse(this.config.headers);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          Object.assign(headersObj, parsed);
        }
      } catch (e) {
        console.warn('Invalid agent headers JSON, ignoring', e);
      }
    }
    if (!headersObj['Content-Type'] && !headersObj['content-type']) {
      headersObj['Content-Type'] = 'application/json';
    }

    // Трейс для fallback запроса
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

    let responseData;
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

    responseData = await response.json();
    if (onTrace) {
      onTrace({
        type: 'response',
        timestamp: Date.now(),
        responseStatus: response.status,
        responseBody: responseData,
      });
    }

    return responseData.reply || responseData.result || 'Ответ не получен';
  }
}
