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
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
} from "./types.js";

export class LocalHookClient implements Hook {
  constructor(private hook: Hook) {}

  get name(): string {
    return this.hook.name;
  }

  /**
   * Process a tool call through the hook
   */
  async processRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    try {
      return await this.hook.processRequest(toolCall);
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
  async processResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    try {
      return await this.hook.processResponse(response, originalToolCall);
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
  async processToolsList(
    request: ListToolsRequest,
  ): Promise<ListToolsRequestHookResult> {
    try {
      // Check if hook supports tools/list processing
      if (!this.hook.processToolsList) {
        return {
          resultType: "continue",
          request: request,
        };
      }
      return await this.hook.processToolsList(request);
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
}
