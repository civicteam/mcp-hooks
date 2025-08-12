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
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  Hook,
  InitializeRequestHookResult,
  InitializeResponseHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  NotificationHookResult,
  RequestHookResult,
  ResponseHookResult,
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
  ): Promise<CallToolRequestHookResult> {
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
  ): Promise<CallToolResponseHookResult> {
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

  /**
   * Process a request from the client NOT covered by a dedicated handler
   */
  async processOtherRequest(request: Request): Promise<RequestHookResult> {
    try {
      // Check if hook supports other request processing
      if (!this.hook.processOtherRequest) {
        return {
          resultType: "continue",
          request,
        };
      }
      return await this.hook.processOtherRequest(request);
    } catch (error) {
      console.error(
        `Hook ${this.name} other request processing failed:`,
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
   * Process a response from the client NOT covered by a dedicated handler
   */
  async processOtherResponse(
    response: Result,
    originalRequest: Request,
  ): Promise<ResponseHookResult> {
    try {
      // Check if hook supports other response processing
      if (!this.hook.processOtherResponse) {
        return {
          resultType: "continue",
          response,
        };
      }
      return await this.hook.processOtherResponse(response, originalRequest);
    } catch (error) {
      console.error(
        `Hook ${this.name} other response processing failed:`,
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
   * Process a target request through the hook
   */
  async processTargetRequest(request: Request): Promise<RequestHookResult> {
    try {
      // Check if hook supports target request processing
      if (!this.hook.processTargetRequest) {
        return {
          resultType: "continue",
          request,
        };
      }
      return await this.hook.processTargetRequest(request);
    } catch (error) {
      console.error(
        `Hook ${this.name} target request processing failed:`,
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
   * Process a target response through the hook
   */
  async processTargetResponse(
    response: Result,
    originalRequest: Request,
  ): Promise<ResponseHookResult> {
    try {
      // Check if hook supports target response processing
      if (!this.hook.processTargetResponse) {
        return {
          resultType: "continue",
          response,
        };
      }
      return await this.hook.processTargetResponse(response, originalRequest);
    } catch (error) {
      console.error(
        `Hook ${this.name} target response processing failed:`,
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
   * Process a notification through the hook
   */
  async processNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    try {
      // Check if hook supports notification processing
      if (!this.hook.processNotification) {
        return {
          resultType: "continue",
          notification,
        };
      }
      return await this.hook.processNotification(notification);
    } catch (error) {
      console.error(`Hook ${this.name} notification processing failed:`, error);
      // On error, continue with unmodified notification
      return {
        resultType: "continue",
        notification,
      };
    }
  }

  /**
   * Process a target notification through the hook
   */
  async processTargetNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    try {
      // Check if hook supports target notification processing
      if (!this.hook.processTargetNotification) {
        return {
          resultType: "continue",
          notification,
        };
      }
      return await this.hook.processTargetNotification(notification);
    } catch (error) {
      console.error(
        `Hook ${this.name} target notification processing failed:`,
        error,
      );
      // On error, continue with unmodified notification
      return {
        resultType: "continue",
        notification,
      };
    }
  }
}
