import type {
  CallToolResult,
  InitializeResult,
  ListToolsResult,
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolRequestHookResult,
  CallToolRequestWithContext,
  CallToolResponseHookResult,
  Hook,
  InitializeRequestHookResult,
  InitializeRequestWithContext,
  InitializeResponseHookResult,
  ListToolsRequestHookResult,
  ListToolsRequestWithContext,
  ListToolsResponseHookResult,
  NotificationHookResult,
  RequestExtra,
  RequestHookResult,
  ResponseHookResult,
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
  async processCallToolRequest(
    request: CallToolRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    return {
      resultType: "continue",
      request,
    };
  }

  /**
   * Process a tool call response.
   * Default implementation passes through without modification.
   */
  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    return {
      resultType: "continue",
      response,
    };
  }

  /**
   * Process a tools/list request.
   * Default implementation passes through without modification.
   */
  async processListToolsRequest?(
    request: ListToolsRequestWithContext,
    requestExtra: RequestExtra,
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
  async processListToolsResult?(
    response: ListToolsResult,
    originalRequest: ListToolsRequestWithContext,
    originalRequestExtra: RequestExtra,
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
    requestExtra: RequestExtra,
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
  async processInitializeResult?(
    response: InitializeResult,
    originalRequest: InitializeRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process a request from the client NOT covered by a dedicated handler.
   * Default implementation passes through without modification.
   */
  async processOtherRequest?(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a response from the client NOT covered by a dedicated handler.
   * Default implementation passes through without modification.
   */
  async processOtherResult?(
    response: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process a target request.
   * Default implementation passes through without modification.
   */
  async processTargetRequest?(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a target response.
   * Default implementation passes through without modification.
   */
  async processTargetResult?(
    response: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process a notification.
   * Default implementation passes through without modification.
   */
  async processNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    return {
      resultType: "continue",
      notification: notification,
    };
  }

  /**
   * Process a target notification.
   * Default implementation passes through without modification.
   */
  async processTargetNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    return {
      resultType: "continue",
      notification: notification,
    };
  }
}
