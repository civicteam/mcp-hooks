import type {
  CallToolResult,
  InitializeResult,
  ListToolsResult,
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolErrorHookResult,
  CallToolRequestHookResult,
  CallToolRequestWithContext,
  CallToolResponseHookResult,
  Hook,
  HookChainError,
  InitializeErrorHookResult,
  InitializeRequestHookResult,
  InitializeRequestWithContext,
  InitializeResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsRequestWithContext,
  ListToolsResponseHookResult,
  NotificationErrorHookResult,
  NotificationHookResult,
  OtherErrorHookResult,
  RequestExtra,
  RequestHookResult,
  ResponseHookResult,
  TargetErrorHookResult,
  TargetNotificationErrorHookResult,
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
   * Process errors for tool calls.
   * Default implementation continues with the error unchanged.
   */
  async processCallToolError(
    error: HookChainError,
    originalCallToolRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult> {
    return { resultType: "continue" };
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
   * Process errors for tools/list requests.
   * Default implementation continues with the error unchanged.
   */
  async processListToolsError?(
    error: HookChainError,
    originalRequest: ListToolsRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsErrorHookResult> {
    return { resultType: "continue" };
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
   * Process errors for initialize requests.
   * Default implementation continues with the error unchanged.
   */
  async processInitializeError?(
    error: HookChainError,
    originalRequest: InitializeRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeErrorHookResult> {
    return { resultType: "continue" };
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
   * Process errors for other requests.
   * Default implementation continues with the error unchanged.
   */
  async processOtherError?(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<OtherErrorHookResult> {
    return { resultType: "continue" };
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
   * Process errors for target requests.
   * Default implementation continues with the error unchanged.
   */
  async processTargetError?(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<TargetErrorHookResult> {
    return { resultType: "continue" };
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
   * Process errors for notifications.
   * Default implementation continues with the error unchanged.
   */
  async processNotificationError?(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<NotificationErrorHookResult> {
    return { resultType: "continue" };
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

  /**
   * Process errors for target notifications.
   * Default implementation continues with the error unchanged.
   */
  async processTargetNotificationError?(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<TargetNotificationErrorHookResult> {
    return { resultType: "continue" };
  }
}
