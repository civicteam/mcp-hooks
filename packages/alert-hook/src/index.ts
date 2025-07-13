/**
 * Alert Hook - Triggers alerts on 5xx transport errors
 *
 * This hook monitors transport errors and sends alerts when
 * 5xx HTTP errors are detected.
 */
import {
  AbstractHook,
  type InitializeTransportErrorHookResult,
  type ListToolsTransportErrorHookResult,
  type ToolCallTransportErrorHookResult,
  type TransportError,
  createHookRouter,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  InitializeRequest,
  ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

/**
 * Configuration for alert notifications
 */
interface AlertConfig {
  /**
   * Webhook URL to send alerts to (optional)
   */
  webhookUrl?: string;
}

/**
 * Hook that monitors for 5xx errors and triggers alerts
 */
export class AlertHook extends AbstractHook {
  private config: AlertConfig;

  constructor(config: AlertConfig) {
    super();
    this.config = config;
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "AlertHook";
  }

  /**
   * Process transport errors for tool calls
   */
  async processToolCallTransportError(
    error: TransportError,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallTransportErrorHookResult> {
    // Check if error is a 5xx HTTP error
    if (this.is5xxError(error)) {
      await this.sendAlert({
        type: "tool_call_error",
        tool: originalToolCall.params.name,
        error: this.formatError(error),
        timestamp: new Date().toISOString(),
      });
    }

    // Continue with the error
    return {
      resultType: "continue",
      error: error,
    };
  }

  /**
   * Process transport errors for tools/list requests
   */
  async processToolsListTransportError(
    error: TransportError,
    _originalRequest: ListToolsRequest,
  ): Promise<ListToolsTransportErrorHookResult> {
    // Check if error is a 5xx HTTP error
    if (this.is5xxError(error)) {
      await this.sendAlert({
        type: "tools_list_error",
        error: this.formatError(error),
        timestamp: new Date().toISOString(),
      });
    }

    // Continue with the error
    return {
      resultType: "continue",
      error: error,
    };
  }

  /**
   * Process transport errors for initialize requests
   */
  async processInitializeTransportError(
    error: TransportError,
    _originalRequest: InitializeRequest,
  ): Promise<InitializeTransportErrorHookResult> {
    console.log(`[AlertHook] processInitializeTransportError called with error:`, error);
    
    // Check if error is a 5xx HTTP error
    if (this.is5xxError(error)) {
      console.log(`[AlertHook] Detected 5xx error, sending alert`);
      await this.sendAlert({
        type: "initialize_error",
        error: this.formatError(error),
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`[AlertHook] Error code ${error.code} is not 5xx, skipping alert`);
    }

    // Continue with the error
    return {
      resultType: "continue",
      error: error,
    };
  }

  /**
   * Check if the error is a 5xx HTTP error
   */
  private is5xxError(error: TransportError): boolean {
    return error.code >= 500 && error.code < 600;
  }

  /**
   * Format error for alerting
   */
  private formatError(error: TransportError): Record<string, unknown> {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: Record<string, unknown>): Promise<void> {
    console.log(`[AlertHook] Sending alert:`, JSON.stringify(alert, null, 2));
    
    // Send to webhook if configured
    if (this.config.webhookUrl) {
      console.log(`[AlertHook] Sending to webhook: ${this.config.webhookUrl}`);
      try {
        const response = await fetch(this.config.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(alert),
        });

        if (!response.ok) {
          console.error(
            `Failed to send alert to webhook: ${response.status} ${response.statusText}`,
          );
        } else {
          console.log(`[AlertHook] Alert sent successfully`);
        }
      } catch (error) {
        console.error("Error sending alert to webhook:", error);
      }
    } else {
      console.log(`[AlertHook] No webhook URL configured`);
    }
  }
}

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33007;
const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

// Create and start the server
const hook = new AlertHook({
  webhookUrl: WEBHOOK_URL,
});

const router = createHookRouter(hook);

const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Alert Hook running on port ${PORT}`);
if (WEBHOOK_URL) {
  console.log(`Alerts will be sent to: ${WEBHOOK_URL}`);
}
