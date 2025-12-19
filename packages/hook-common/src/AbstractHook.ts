import type {
  CallToolResult,
  InitializeResult,
  ListPromptsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ListToolsResult,
  Notification,
  ReadResourceResult,
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
  ListPromptsErrorHookResult,
  ListPromptsRequestHookResult,
  ListPromptsRequestWithContext,
  ListPromptsResponseHookResult,
  ListResourcesErrorHookResult,
  ListResourcesRequestHookResult,
  ListResourcesRequestWithContext,
  ListResourcesResponseHookResult,
  ListResourceTemplatesErrorHookResult,
  ListResourceTemplatesRequestHookResult,
  ListResourceTemplatesRequestWithContext,
  ListResourceTemplatesResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsRequestWithContext,
  ListToolsResponseHookResult,
  NotificationErrorHookResult,
  NotificationHookResult,
  OtherErrorHookResult,
  ReadResourceErrorHookResult,
  ReadResourceRequestHookResult,
  ReadResourceRequestWithContext,
  ReadResourceResponseHookResult,
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
    _requestExtra: RequestExtra,
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
    _originalCallToolRequest: CallToolRequestWithContext,
    _originalRequestExtra: RequestExtra,
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
    _error: HookChainError,
    _originalCallToolRequest: CallToolRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a prompts/list request.
   * Default implementation passes through without modification.
   */
  async processListPromptsRequest(
    request: ListPromptsRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<ListPromptsRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a prompts/list response.
   * Default implementation passes through without modification.
   */
  async processListPromptsResult(
    response: ListPromptsResult,
    _originalRequest: ListPromptsRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process errors for prompts/list requests.
   * Default implementation continues with the error unchanged.
   */
  async processListPromptsError(
    _error: HookChainError,
    _originalRequest: ListPromptsRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a tools/list request.
   * Default implementation passes through without modification.
   */
  async processListToolsRequest(
    request: ListToolsRequestWithContext,
    _requestExtra: RequestExtra,
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
  async processListToolsResult(
    response: ListToolsResult,
    _originalRequest: ListToolsRequestWithContext,
    _originalRequestExtra: RequestExtra,
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
  async processListToolsError(
    _error: HookChainError,
    _originalRequest: ListToolsRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListToolsErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process an initialize request.
   * Default implementation passes through without modification.
   */
  async processInitializeRequest(
    request: InitializeRequestWithContext,
    _requestExtra: RequestExtra,
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
  async processInitializeResult(
    response: InitializeResult,
    _originalRequest: InitializeRequestWithContext,
    _originalRequestExtra: RequestExtra,
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
  async processInitializeError(
    _error: HookChainError,
    _originalRequest: InitializeRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<InitializeErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a request from the client NOT covered by a dedicated handler.
   * Default implementation passes through without modification.
   */
  async processOtherRequest(
    request: Request,
    _requestExtra: RequestExtra,
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
  async processOtherResult(
    response: Result,
    _originalRequest: Request,
    _originalRequestExtra: RequestExtra,
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
  async processOtherError(
    _error: HookChainError,
    _originalRequest: Request,
    _originalRequestExtra: RequestExtra,
  ): Promise<OtherErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a target request.
   * Default implementation passes through without modification.
   */
  async processTargetRequest(
    request: Request,
    _requestExtra: RequestExtra,
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
  async processTargetResult(
    response: Result,
    _originalRequest: Request,
    _originalRequestExtra: RequestExtra,
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
  async processTargetError(
    _error: HookChainError,
    _originalRequest: Request,
    _originalRequestExtra: RequestExtra,
  ): Promise<TargetErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a notification.
   * Default implementation passes through without modification.
   */
  async processNotification(
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
  async processNotificationError(
    _error: HookChainError,
    _originalNotification: Notification,
  ): Promise<NotificationErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a target notification.
   * Default implementation passes through without modification.
   */
  async processTargetNotification(
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
  async processTargetNotificationError(
    _error: HookChainError,
    _originalNotification: Notification,
  ): Promise<TargetNotificationErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a resources/list request.
   * Default implementation passes through without modification.
   */
  async processListResourcesRequest(
    request: ListResourcesRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<ListResourcesRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a resources/list response.
   * Default implementation passes through without modification.
   */
  async processListResourcesResult(
    response: ListResourcesResult,
    _originalRequest: ListResourcesRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process errors for resources/list requests.
   * Default implementation continues with the error unchanged.
   */
  async processListResourcesError(
    _error: HookChainError,
    _originalRequest: ListResourcesRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a resources/templates/list request.
   * Default implementation passes through without modification.
   */
  async processListResourceTemplatesRequest(
    request: ListResourceTemplatesRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a resources/templates/list response.
   * Default implementation passes through without modification.
   */
  async processListResourceTemplatesResult(
    response: ListResourceTemplatesResult,
    _originalRequest: ListResourceTemplatesRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process errors for resources/templates/list requests.
   * Default implementation continues with the error unchanged.
   */
  async processListResourceTemplatesError(
    _error: HookChainError,
    _originalRequest: ListResourceTemplatesRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesErrorHookResult> {
    return { resultType: "continue" };
  }

  /**
   * Process a resources/read request.
   * Default implementation passes through without modification.
   */
  async processReadResourceRequest(
    request: ReadResourceRequestWithContext,
    _requestExtra: RequestExtra,
  ): Promise<ReadResourceRequestHookResult> {
    return {
      resultType: "continue",
      request: request,
    };
  }

  /**
   * Process a resources/read response.
   * Default implementation passes through without modification.
   */
  async processReadResourceResult(
    response: ReadResourceResult,
    _originalRequest: ReadResourceRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceResponseHookResult> {
    return {
      resultType: "continue",
      response: response,
    };
  }

  /**
   * Process errors for resources/read requests.
   * Default implementation continues with the error unchanged.
   */
  async processReadResourceError(
    _error: HookChainError,
    _originalRequest: ReadResourceRequestWithContext,
    _originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceErrorHookResult> {
    return { resultType: "continue" };
  }
}
