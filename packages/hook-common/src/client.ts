import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import type {
  CallToolRequest,
  InitializeRequest,
  InitializeResult,
  ListPromptsRequest,
  ListPromptsResult,
  ListResourceTemplatesRequest,
  ListResourceTemplatesResult,
  ListResourcesRequest,
  ListResourcesResult,
  ListToolsRequest,
  ListToolsResult,
  Notification,
  ReadResourceRequest,
  ReadResourceResult,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { HookRouter } from "./router.js";
import type {
  CallToolErrorHookResult,
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  Hook,
  HookChainError,
  InitializeErrorHookResult,
  InitializeRequestHookResult,
  InitializeResponseHookResult,
  ListPromptsErrorHookResult,
  ListPromptsRequestHookResult,
  ListPromptsResponseHookResult,
  ListResourceTemplatesErrorHookResult,
  ListResourceTemplatesRequestHookResult,
  ListResourceTemplatesResponseHookResult,
  ListResourcesErrorHookResult,
  ListResourcesRequestHookResult,
  ListResourcesResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  NotificationErrorHookResult,
  NotificationHookResult,
  OtherErrorHookResult,
  ReadResourceErrorHookResult,
  ReadResourceRequestHookResult,
  ReadResourceResponseHookResult,
  RequestExtra,
  RequestHookResult,
  ResponseHookResult,
  TargetErrorHookResult,
  TargetNotificationErrorHookResult,
} from "./types.js";

/**
 * Configuration for a remote hook client
 */
export interface RemoteHookConfig {
  url: string;
  name: string;
}

/**
 * Helper function to handle hook method errors consistently
 * @param error The error from the tRPC call
 * @param hookName The name of the hook for logging
 * @param methodName The method that failed
 * @param fallbackResult The result to return when continuing
 * @returns The fallback result or throws the error
 */
function handleHookError<T>(
  error: unknown,
  hookName: string,
  methodName: string,
  fallbackResult: T,
): T {
  // Check if it's a "not implemented" error
  if (error instanceof Error && error.message.includes("not implemented")) {
    // Hook doesn't support this method, continue silently
    return fallbackResult;
  }

  // Propagate all other errors
  throw error;
}

/**
 * Remote tRPC-based hook client
 */
export class RemoteHookClient implements Hook {
  private client: ReturnType<typeof createTRPCClient<HookRouter>>;
  private _name: string;

  get name(): string {
    return this._name;
  }

  constructor(config: RemoteHookConfig) {
    this._name = config.name;
    this.client = createTRPCClient<HookRouter>({
      links: [
        httpBatchLink({
          url: config.url,
          transformer: superjson,
        }),
      ],
    });
  }

  /**
   * Process a tool call through the hook
   */
  async processCallToolRequest(
    request: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    try {
      return await this.client.processCallToolRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processCallToolRequest", {
        resultType: "continue" as const,
        request,
      });
    }
  }

  /**
   * Process a response through the hook
   */
  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    try {
      return await this.client.processCallToolResult.mutate({
        response,
        originalCallToolRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processCallToolResult", {
        resultType: "continue" as const,
        response,
      });
    }
  }

  /**
   * Process a prompts/list request through the hook
   */
  async processListPromptsRequest(
    request: ListPromptsRequest,
    requestExtra: RequestExtra,
  ): Promise<ListPromptsRequestHookResult> {
    try {
      return await this.client.processListPromptsRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListPromptsRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process a prompts/list response through the hook
   */
  async processListPromptsResult(
    response: ListPromptsResult,
    originalRequest: ListPromptsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsResponseHookResult> {
    try {
      return await this.client.processListPromptsResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListPromptsResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process a tools/list request through the hook
   */
  async processListToolsRequest(
    request: ListToolsRequest,
    requestExtra: RequestExtra,
  ): Promise<ListToolsRequestHookResult> {
    try {
      return await this.client.processListToolsRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListToolsRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process a tools/list response through the hook
   */
  async processListToolsResult(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsResponseHookResult> {
    try {
      return await this.client.processListToolsResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListToolsResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process an initialize request through the hook
   */
  async processInitializeRequest(
    request: InitializeRequest,
    requestExtra: RequestExtra,
  ): Promise<InitializeRequestHookResult> {
    try {
      return await this.client.processInitializeRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processInitializeRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process an initialize response through the hook
   */
  async processInitializeResult(
    response: InitializeResult,
    originalRequest: InitializeRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeResponseHookResult> {
    try {
      return await this.client.processInitializeResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processInitializeResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process a target request through the hook
   */
  async processTargetRequest(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult> {
    try {
      return await this.client.processTargetRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processTargetRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process a target response through the hook
   */
  async processTargetResult(
    response: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult> {
    try {
      return await this.client.processTargetResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processTargetResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process a notification through the hook
   */
  async processNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    try {
      return await this.client.processNotification.mutate(notification);
    } catch (error) {
      return handleHookError(error, this.name, "processNotification", {
        resultType: "continue" as const,
        notification: notification,
      });
    }
  }

  /**
   * Process a target notification through the hook
   */
  async processTargetNotification(
    notification: Notification,
  ): Promise<NotificationHookResult> {
    try {
      return await this.client.processTargetNotification.mutate(notification);
    } catch (error) {
      return handleHookError(error, this.name, "processTargetNotification", {
        resultType: "continue" as const,
        notification: notification,
      });
    }
  }

  /**
   * Process errors for tool calls
   */
  async processCallToolError(
    error: HookChainError,
    originalToolCall: CallToolRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult> {
    try {
      return await this.client.processCallToolError.mutate({
        error,
        originalToolCall,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processCallToolError", {
        resultType: "continue" as const,
      });
    }
  }

  /**
   * Process errors for prompts/list requests
   */
  async processListPromptsError(
    error: HookChainError,
    originalRequest: ListPromptsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsErrorHookResult> {
    try {
      return await this.client.processListPromptsError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processListPromptsError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }

  /**
   * Process errors for tools/list requests
   */
  async processListToolsError(
    error: HookChainError,
    originalRequest: ListToolsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsErrorHookResult> {
    try {
      return await this.client.processListToolsError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processListToolsError", {
        resultType: "continue" as const,
      });
    }
  }

  /**
   * Process errors for initialize requests
   */
  async processInitializeError(
    error: HookChainError,
    originalRequest: InitializeRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeErrorHookResult> {
    try {
      return await this.client.processInitializeError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processInitializeError", {
        resultType: "continue" as const,
      });
    }
  }

  /**
   * Process errors for other requests
   */
  async processOtherError(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<OtherErrorHookResult> {
    try {
      return await this.client.processOtherError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processOtherError", {
        resultType: "continue" as const,
      });
    }
  }

  /**
   * Process errors for target requests
   */
  async processTargetError(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<TargetErrorHookResult> {
    try {
      return await this.client.processTargetError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processTargetError", {
        resultType: "continue" as const,
      });
    }
  }

  /**
   * Process errors for notifications
   */
  async processNotificationError(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<NotificationErrorHookResult> {
    try {
      return await this.client.processNotificationError.mutate({
        error,
        originalNotification,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processNotificationError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }

  /**
   * Process errors for target notifications
   */
  async processTargetNotificationError(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<TargetNotificationErrorHookResult> {
    try {
      return await this.client.processTargetNotificationError.mutate({
        error,
        originalNotification,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processTargetNotificationError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }

  /**
   * Process a resources/list request through the hook
   */
  async processListResourcesRequest(
    request: ListResourcesRequest,
    requestExtra: RequestExtra,
  ): Promise<ListResourcesRequestHookResult> {
    try {
      return await this.client.processListResourcesRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListResourcesRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process a resources/list response through the hook
   */
  async processListResourcesResult(
    response: ListResourcesResult,
    originalRequest: ListResourcesRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesResponseHookResult> {
    try {
      return await this.client.processListResourcesResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processListResourcesResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process errors for resources/list requests
   */
  async processListResourcesError(
    error: HookChainError,
    originalRequest: ListResourcesRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesErrorHookResult> {
    try {
      return await this.client.processListResourcesError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processListResourcesError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }

  /**
   * Process a resources/templates/list request through the hook
   */
  async processListResourceTemplatesRequest(
    request: ListResourceTemplatesRequest,
    requestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesRequestHookResult> {
    try {
      return await this.client.processListResourceTemplatesRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(
        error,
        this.name,
        "processListResourceTemplatesRequest",
        {
          resultType: "continue" as const,
          request: request,
        },
      );
    }
  }

  /**
   * Process a resources/templates/list response through the hook
   */
  async processListResourceTemplatesResult(
    response: ListResourceTemplatesResult,
    originalRequest: ListResourceTemplatesRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesResponseHookResult> {
    try {
      return await this.client.processListResourceTemplatesResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(
        error,
        this.name,
        "processListResourceTemplatesResult",
        {
          resultType: "continue" as const,
          response: response,
        },
      );
    }
  }

  /**
   * Process errors for resources/templates/list requests
   */
  async processListResourceTemplatesError(
    error: HookChainError,
    originalRequest: ListResourceTemplatesRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesErrorHookResult> {
    try {
      return await this.client.processListResourceTemplatesError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processListResourceTemplatesError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }

  /**
   * Process a resources/read request through the hook
   */
  async processReadResourceRequest(
    request: ReadResourceRequest,
    requestExtra: RequestExtra,
  ): Promise<ReadResourceRequestHookResult> {
    try {
      return await this.client.processReadResourceRequest.mutate({
        request,
        requestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processReadResourceRequest", {
        resultType: "continue" as const,
        request: request,
      });
    }
  }

  /**
   * Process a resources/read response through the hook
   */
  async processReadResourceResult(
    response: ReadResourceResult,
    originalRequest: ReadResourceRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceResponseHookResult> {
    try {
      return await this.client.processReadResourceResult.mutate({
        response,
        originalRequest,
        originalRequestExtra,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processReadResourceResult", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process errors for resources/read requests
   */
  async processReadResourceError(
    error: HookChainError,
    originalRequest: ReadResourceRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceErrorHookResult> {
    try {
      return await this.client.processReadResourceError.mutate({
        error,
        originalRequest,
        originalRequestExtra,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processReadResourceError",
        {
          resultType: "continue" as const,
        },
      );
    }
  }
}

/**
 * Create remote hook clients from configuration
 */
export function createRemoteHookClients(
  configs: RemoteHookConfig[],
): RemoteHookClient[] {
  return configs.map((config) => new RemoteHookClient(config));
}
