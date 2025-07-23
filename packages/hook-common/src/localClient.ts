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
  InitializeTransportErrorHookResult,
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

  /**
   * Process an initialize transport error through the hook
   */
  async processInitializeTransportError(
    error: TransportError,
    originalRequest: InitializeRequest,
  ): Promise<InitializeTransportErrorHookResult> {
    try {
      // Check if hook supports initialize transport error processing
      if (!this.hook.processInitializeTransportError) {
        return {
          resultType: "continue",
          error,
        };
      }
      return await this.hook.processInitializeTransportError(
        error,
        originalRequest,
      );
    } catch (hookError) {
      console.error(
        `Hook ${this.name} initialize transport error processing failed:`,
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
