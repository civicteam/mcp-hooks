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
  CallToolErrorHookResult,
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  Hook,
  HookChainError,
  InitializeErrorHookResult,
  InitializeRequestHookResult,
  InitializeResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
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

export class LocalHookClient implements Hook {
  constructor(private hook: Hook) {}

  get name(): string {
    return this.hook.name;
  }

  /**
   * Process a tool call through the hook
   */
  async processCallToolRequest(
    request: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    // Check if hook supports this method
    if (!this.hook.processCallToolRequest) {
      return {
        resultType: "continue",
        request,
      };
    }
    return await this.hook.processCallToolRequest(request, requestExtra);
  }

  /**
   * Process a response through the hook
   */
  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    // Check if hook supports this method
    if (!this.hook.processCallToolResult) {
      return {
        resultType: "continue",
        response: response,
      };
    }
    return await this.hook.processCallToolResult(
      response,
      originalCallToolRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process a tools/list request through the hook
   */
  async processListToolsRequest(
    request: ListToolsRequest,
    requestExtra: RequestExtra,
  ): Promise<ListToolsRequestHookResult> {
    // Check if hook supports tools/list processing
    if (!this.hook.processListToolsRequest) {
      return {
        resultType: "continue",
        request: request,
      };
    }
    return await this.hook.processListToolsRequest(request, requestExtra);
  }

  /**
   * Process a tools/list response through the hook
   */
  async processListToolsResult(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsResponseHookResult> {
    // Check if hook supports tools/list response processing
    if (!this.hook.processListToolsResult) {
      return {
        resultType: "continue",
        response: response,
      };
    }
    return await this.hook.processListToolsResult(
      response,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process an initialize request through the hook
   */
  async processInitializeRequest(
    request: InitializeRequest,
    requestExtra: RequestExtra,
  ): Promise<InitializeRequestHookResult> {
    // Check if hook supports initialize request processing
    if (!this.hook.processInitializeRequest) {
      return {
        resultType: "continue",
        request,
      };
    }
    return await this.hook.processInitializeRequest(request, requestExtra);
  }

  /**
   * Process an initialize response through the hook
   */
  async processInitializeResult(
    response: InitializeResult,
    originalRequest: InitializeRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeResponseHookResult> {
    // Check if hook supports initialize response processing
    if (!this.hook.processInitializeResult) {
      return {
        resultType: "continue",
        response,
      };
    }
    return await this.hook.processInitializeResult(
      response,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process a request from the client NOT covered by a dedicated handler
   */
  async processOtherRequest(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult> {
    // Check if hook supports other request processing
    if (!this.hook.processOtherRequest) {
      return {
        resultType: "continue",
        request,
      };
    }
    return await this.hook.processOtherRequest(request, requestExtra);
  }

  /**
   * Process a response from the client NOT covered by a dedicated handler
   */
  async processOtherResult(
    response: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult> {
    // Check if hook supports other response processing
    if (!this.hook.processOtherResult) {
      return {
        resultType: "continue",
        response,
      };
    }
    return await this.hook.processOtherResult(
      response,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process a target request through the hook
   */
  async processTargetRequest(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult> {
    // Check if hook supports target request processing
    if (!this.hook.processTargetRequest) {
      return {
        resultType: "continue",
        request,
      };
    }
    return await this.hook.processTargetRequest(request, requestExtra);
  }

  /**
   * Process a target response through the hook
   */
  async processTargetResult(
    response: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult> {
    // Check if hook supports target response processing
    if (!this.hook.processTargetResult) {
      return {
        resultType: "continue",
        response,
      };
    }
    return await this.hook.processTargetResult(
      response,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process a notification through the hook
   */
  async processNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    // Check if hook supports notification processing
    if (!this.hook.processNotification) {
      return {
        resultType: "continue",
        notification,
      };
    }
    return await this.hook.processNotification(notification);
  }

  /**
   * Process a target notification through the hook
   */
  async processTargetNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    // Check if hook supports target notification processing
    if (!this.hook.processTargetNotification) {
      return {
        resultType: "continue",
        notification,
      };
    }
    return await this.hook.processTargetNotification(notification);
  }

  /**
   * Process errors for tool calls
   */
  async processCallToolError(
    error: HookChainError,
    originalToolCall: CallToolRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processCallToolError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processCallToolError(
      error,
      originalToolCall,
      originalRequestExtra,
    );
  }

  /**
   * Process errors for tools/list requests
   */
  async processListToolsError(
    error: HookChainError,
    originalRequest: ListToolsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processListToolsError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processListToolsError(
      error,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process errors for initialize requests
   */
  async processInitializeError(
    error: HookChainError,
    originalRequest: InitializeRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processInitializeError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processInitializeError(
      error,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process errors for other requests
   */
  async processOtherError(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<OtherErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processOtherError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processOtherError(
      error,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process errors for target requests
   */
  async processTargetError(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<TargetErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processTargetError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processTargetError(
      error,
      originalRequest,
      originalRequestExtra,
    );
  }

  /**
   * Process errors for notifications
   */
  async processNotificationError(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<NotificationErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processNotificationError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processNotificationError(
      error,
      originalNotification,
    );
  }

  /**
   * Process errors for target notifications
   */
  async processTargetNotificationError(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<TargetNotificationErrorHookResult> {
    // Check if hook supports error processing
    if (!this.hook.processTargetNotificationError) {
      return {
        resultType: "continue",
      };
    }
    return await this.hook.processTargetNotificationError(
      error,
      originalNotification,
    );
  }
}
