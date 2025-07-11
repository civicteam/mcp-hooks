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
  async processToolCallResponse(
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
  async processToolsListRequest?(
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

  /**
   * Process transport errors for tool calls.
   * Default implementation passes through without modification.
   */
  async processToolCallTransportError?(
    error: TransportError,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallTransportErrorHookResult> {
    return {
      resultType: "continue",
      error: error,
    };
  }

  /**
   * Process transport errors for tools/list requests.
   * Default implementation passes through without modification.
   */
  async processToolsListTransportError?(
    error: TransportError,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsTransportErrorHookResult> {
    return {
      resultType: "continue",
      error: error,
    };
  }
}
