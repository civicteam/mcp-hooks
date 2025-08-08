/**
 * Local Hook Client
 *
 * Wraps a Hook instance for local execution
 */

import type {
  CallToolRequest,
  CallToolResult,
  InitializeRequest,
  InitializeResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  Hook,
  InitializeRequestHookResult,
  InitializeResponseHookResult,
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
  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    try {
      // Check if hook supports this method
      if (!this.hook.processToolCallRequest) {
        return {
          resultType: "continue",
          request: toolCall,
        };
      }
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
      // Check if hook supports this method
      if (!this.hook.processToolCallResponse) {
        return {
          resultType: "continue",
          response: response,
        };
      }
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
   * Process an initialize request through the hook
   */
  async processInitializeRequest(
    request: InitializeRequest,
  ): Promise<InitializeRequestHookResult> {
    try {
      // Check if hook supports initialize request processing
      if (!this.hook.processInitializeRequest) {
        return {
          resultType: "continue",
          request,
        };
      }
      return await this.hook.processInitializeRequest(request);
    } catch (error) {
      console.error(
        `Hook ${this.name} initialize request processing failed:`,
        error,
      );
      // On error, continue with unmodified request
      return {
        resultType: "continue",
        request,
      };
    }
  }

  /**
   * Process an initialize response through the hook
   */
  async processInitializeResponse(
    response: InitializeResult,
    originalRequest: InitializeRequest,
  ): Promise<InitializeResponseHookResult> {
    try {
      // Check if hook supports initialize response processing
      if (!this.hook.processInitializeResponse) {
        return {
          resultType: "continue",
          response,
        };
      }
      return await this.hook.processInitializeResponse(
        response,
        originalRequest,
      );
    } catch (error) {
      console.error(
        `Hook ${this.name} initialize response processing failed:`,
        error,
      );
      // On error, continue with unmodified response
      return {
        resultType: "continue",
        response,
      };
    }
  }
}
