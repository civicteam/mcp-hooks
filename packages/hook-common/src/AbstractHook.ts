import type {
  CallToolResult,
  InitializeResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolRequestWithContext,
  Hook,
  InitializeRequestHookResult,
  InitializeRequestWithContext,
  InitializeResponseHookResult,
  ListToolsRequestHookResult,
  ListToolsRequestWithContext,
  ListToolsResponseHookResult,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
} from "./types.js";

/**
 * Abstract base class for hooks that provides default pass-through implementations
 * for all hook methods. Extend this class to create custom hooks and override
 * only the methods you need.
 */
export abstract class AbstractHook implements Hook {
  /**
   * The name of this hook. Must be implemented by subclasses.
   */
  abstract get name(): string;
  /**
   * Process an incoming tool call request.
   * Default implementation passes through without modification.
   */
  async processToolCallRequest(
    toolCall: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    return {
      resultType: "continue",
      request: toolCall,
    };
  }

  /**
   * Process a tool call response.
   * Default implementation passes through without modification.
   */
  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequestWithContext,
  ): Promise<ToolCallResponseHookResult> {
    return {
      resultType: "continue",
      response,
    };
  }

  /**
   * Process a tools/list request.
   * Default implementation passes through without modification.
   */
  async processToolsListRequest?(
    request: ListToolsRequestWithContext,
  ): Promise<ListToolsRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a tools/list response.
   * Default implementation passes through without modification.
   */
  async processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ListToolsRequestWithContext,
  ): Promise<ListToolsResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process an initialize request.
   * Default implementation passes through without modification.
   */
  async processInitializeRequest?(
    request: InitializeRequestWithContext,
  ): Promise<InitializeRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process an initialize response.
   * Default implementation passes through without modification.
   */
  async processInitializeResponse?(
    response: InitializeResult,
    originalRequest: InitializeRequestWithContext,
  ): Promise<InitializeResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }
}
