import { AgentConfig, EndpointConfig, TraceStep } from 'types';
import { executeWorkflow, executeEndpoint, WorkflowContext } from './WorkflowExecutor';
import { resolveString, VariableContext } from './VariableResolver';

export class AgentClient {
  private config: AgentConfig;
  private context: WorkflowContext = {};
  private initialized = false;
  private isProcessing = false;

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
    // Защита от гонок (#6)
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message. Please wait.');
    }
    this.isProcessing = true;
  
    try {
      // ========== ИНИЦИАЛИЗАЦИЯ (без user_input) ==========
      if (this.config.startupOperation && !this.initialized) {
        const endpointMap = new Map<string, EndpointConfig>(
          this.config.endpoints?.map(ep => [ep.operation, ep]) ?? []
        );
        const startupEndpoint = endpointMap.get(this.config.startupOperation);
        if (startupEndpoint) {
          // Передаём текущий контекст (без user_input)
          await this.runEndpoint(startupEndpoint, this.context, onTrace);
          this.initialized = true;
        }
      }
  
      // ========== ДОБАВЛЯЕМ ВХОДНЫЕ ДАННЫЕ В КОНТЕКСТ ==========
      const context = this.context;
      context.user_input = userInput;
      Object.assign(context, additionalContext);
  
      // ========== ОСНОВНАЯ ЛОГИКА С WORKFLOW ==========
      if (this.config.endpoints?.length && this.config.workflow?.length) {
        const endpointMap = new Map<string, EndpointConfig>(
          this.config.endpoints.map((ep) => [ep.operation, ep])
        );
  
        const steps = this.config.workflow
          .filter(op => op !== this.config.startupOperation)
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
          context,
          this.config.api,
          this.config.config,
          this.config.headers,
          onTrace
        );
  
        return lastResponse.reply || lastResponse.result || JSON.stringify(lastResponse);
      }
  
      // ========== FALLBACK: ПРОСТОЙ POST ==========
      let requestBody: any = { message: userInput };
      if (this.config.config) {
        try {
          let configStr = this.config.config;
          configStr = resolveString(configStr, context);
          requestBody = { ...requestBody, ...JSON.parse(configStr) };
        } catch (e) {
          console.warn('Invalid agent config JSON, ignoring', e);
        }
      }
  
      const headersObj: Record<string, string> = {};
      if (this.config.headers) {
        try {
          let headersStr = this.config.headers;
          headersStr = resolveString(headersStr, context);
          const parsed = JSON.parse(headersStr);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === 'string') {
                headersObj[k] = resolveString(v, context);
              } else if (typeof v === 'number' || typeof v === 'boolean') {
                headersObj[k] = String(v);
              } else {
                headersObj[k] = JSON.stringify(v);
              }
            }
          }
        } catch (e) {
          console.warn('Invalid agent headers JSON, ignoring', e);
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
    } finally {
      this.isProcessing = false;
    }
  }
}
