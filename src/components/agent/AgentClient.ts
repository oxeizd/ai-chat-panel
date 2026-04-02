import { AgentConfig, EndpointConfig } from 'types';
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

  private async runEndpoint(endpoint: EndpointConfig, additionalContext: VariableContext): Promise<any> {
    const combinedContext: WorkflowContext = { ...this.context, ...additionalContext };
    return executeEndpoint(endpoint, combinedContext, this.config.api);
  }

  public async sendMessage(userInput: string, additionalContext: VariableContext = {}): Promise<string> {
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
          await this.runEndpoint(startupEndpoint, context);
          this.initialized = true;
        }
      }

      const lastResponse = await executeWorkflow(steps, context, this.config.api);
      if (lastResponse.thread_id) {
        this.context.thread_id = lastResponse.thread_id;
      }
      if (lastResponse.run_id) {
        this.context.run_id = lastResponse.run_id;
      }

      return lastResponse.reply || lastResponse.result || JSON.stringify(lastResponse);
    }

    // Fallback: single POST to api
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

    const response = await fetch(this.config.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.reply || data.result || 'Ответ не получен';
  }
}
