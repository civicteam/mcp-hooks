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
  async processRequest(
    toolCall: CallToolRequest,
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
  async processResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
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
  async processToolsList?(
    request: ListToolsRequest,
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
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }
}
