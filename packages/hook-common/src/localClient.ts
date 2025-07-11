/**
 * Local Hook Client
 *
 * Wraps a Hook instance for local execution
 */

import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  Hook,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ListToolsTransportErrorHookResult,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
  ToolCallTransportErrorHookResult,
  TransportError,
} from "./types.js";

export class LocalHookClient implements Hook {
  constructor(private hook: Hook) {}

  get name(): string {
    return this.hook.name;
  }

  /**
   * Process a tool call through the hook
   */
  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    try {
      return await this.hook.processToolCallRequest(toolCall);
    } catch (error) {
      console.error(`Hook ${this.name} request processing failed:`, error);
      // On error, continue with unmodified request
      return {
        resultType: "continue",
        request: toolCall,
      };
    }
  }

  /**
   * Process a response through the hook
   */
  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    try {
      return await this.hook.processToolCallResponse(
        response,
        originalToolCall,
      );
    } catch (error) {
      console.error(`Hook ${this.name} response processing failed:`, error);
      // On error, continue with unmodified response
      return {
        resultType: "continue",
        response: response,
      };
    }
  }

  /**
   * Process a tools/list request through the hook
   */
  async processToolsListRequest(
    request: ListToolsRequest,
  ): Promise<ListToolsRequestHookResult> {
    try {
      // Check if hook supports tools/list processing
      if (!this.hook.processToolsListRequest) {
        return {
          resultType: "continue",
          request: request,
        };
      }
      return await this.hook.processToolsListRequest(request);
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list request processing failed:`,
        error,
      );
      // On error, continue with unmodified request
      return {
        resultType: "continue",
        request: request,
      };
    }
  }

  /**
   * Process a tools/list response through the hook
   */
  async processToolsListResponse(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult> {
    try {
      // Check if hook supports tools/list response processing
      if (!this.hook.processToolsListResponse) {
        return {
          resultType: "continue",
          response: response,
        };
      }
      return await this.hook.processToolsListResponse(
        response,
        originalRequest,
      );
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list response processing failed:`,
        error,
      );
      // On error, continue with unmodified response
      return {
        resultType: "continue",
        response: response,
      };
    }
  }

  /**
   * Process a tool call transport error through the hook
   */
  async processToolCallTransportError(
    error: TransportError,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallTransportErrorHookResult> {
    try {
      // Check if hook supports transport error processing
      if (!this.hook.processToolCallTransportError) {
        return {
          resultType: "continue",
          error,
        };
      }
      return await this.hook.processToolCallTransportError(
        error,
        originalToolCall,
      );
    } catch (hookError) {
      console.error(
        `Hook ${this.name} tool call transport error processing failed:`,
        hookError,
      );
      // On error, continue with unmodified error
      return {
        resultType: "continue",
        error,
      };
    }
  }

  /**
   * Process a tools/list transport error through the hook
   */
  async processToolsListTransportError(
    error: TransportError,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsTransportErrorHookResult> {
    try {
      // Check if hook supports transport error processing
      if (!this.hook.processToolsListTransportError) {
        return {
          resultType: "continue",
          error,
        };
      }
      return await this.hook.processToolsListTransportError(
        error,
        originalRequest,
      );
    } catch (hookError) {
      console.error(
        `Hook ${this.name} tools/list transport error processing failed:`,
        hookError,
      );
      // On error, continue with unmodified error
      return {
        resultType: "continue",
        error,
      };
    }
  }
}
