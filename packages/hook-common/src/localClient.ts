/**
 * Local Hook Client
 *
 * Wraps a Hook instance to implement the HookClient interface
 */

import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { HookClient } from "./client.js";
import type {
  Hook,
  HookContext,
  HookResponse,
  ToolCall,
  ToolsListRequest,
} from "./types.js";

export class LocalHookClient implements HookClient {
  public readonly name: string;

  constructor(private hook: Hook) {
    this.name = hook.name;
  }

  /**
   * Process a tool call through the hook
   */
  async processRequest(
    toolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    try {
      return await this.hook.processRequest(toolCall, context);
    } catch (error) {
      console.error(`Hook ${this.name} request processing failed:`, error);
      // On error, continue with unmodified request
      return {
        response: "continue",
        body: toolCall,
      };
    }
  }

  /**
   * Process a response through the hook
   */
  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    try {
      return await this.hook.processResponse(
        response,
        originalToolCall,
        context,
      );
    } catch (error) {
      console.error(`Hook ${this.name} response processing failed:`, error);
      // On error, continue with unmodified response
      return {
        response: "continue",
        body: response,
      };
    }
  }

  /**
   * Process a tools/list request through the hook
   */
  async processToolsList(
    request: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse> {
    try {
      // Check if hook supports tools/list processing
      if (!this.hook.processToolsList) {
        return {
          response: "continue",
          body: request,
        };
      }
      return await this.hook.processToolsList(request, context);
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list request processing failed:`,
        error,
      );
      // On error, continue with unmodified request
      return {
        response: "continue",
        body: request,
      };
    }
  }

  /**
   * Process a tools/list response through the hook
   */
  async processToolsListResponse(
    response: ListToolsResult,
    originalRequest: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse> {
    try {
      // Check if hook supports tools/list response processing
      if (!this.hook.processToolsListResponse) {
        return {
          response: "continue",
          body: response,
        };
      }
      return await this.hook.processToolsListResponse(
        response,
        originalRequest,
        context,
      );
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list response processing failed:`,
        error,
      );
      // On error, continue with unmodified response
      return {
        response: "continue",
        body: response,
      };
    }
  }

  /**
   * Process an exception through the hook
   */
  async processToolException(
    error: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    try {
      // Check if hook supports exception processing
      if (!this.hook.processToolException) {
        return {
          response: "continue",
          body: null,
        };
      }
      return await this.hook.processToolException(
        error,
        originalToolCall,
        context,
      );
    } catch (processingError) {
      console.error(
        `Hook ${this.name} exception processing failed:`,
        processingError,
      );
      // On error, continue (don't handle exception)
      return {
        response: "continue",
        body: null,
      };
    }
  }
}
