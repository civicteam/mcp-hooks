import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import type {
  CallToolRequest,
  InitializeRequest,
  InitializeResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { HookRouter } from "./router.js";
import type {
  Hook,
  InitializeRequestHookResult,
  InitializeResponseHookResult,
  InitializeTransportErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ListToolsTransportErrorHookResult,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
  ToolCallTransportErrorHookResult,
  TransportError,
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
 * @returns The fallback result
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

  // Log other errors
  console.error(`Hook ${hookName} ${methodName} failed:`, error);
  return fallbackResult;
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
  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    try {
      return await this.client.processToolCallRequest.mutate(toolCall);
    } catch (error) {
      return handleHookError(error, this.name, "processToolCallRequest", {
        resultType: "continue" as const,
        request: toolCall,
      });
    }
  }

  /**
   * Process a response through the hook
   */
  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    try {
      return await this.client.processToolCallResponse.mutate({
        response,
        originalToolCall,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processToolCallResponse", {
        resultType: "continue" as const,
        response,
      });
    }
  }

  /**
   * Process a tools/list request through the hook
   */
  async processToolsListRequest(
    request: ListToolsRequest,
  ): Promise<ListToolsRequestHookResult> {
    try {
      return await this.client.processToolsListRequest.mutate(request);
    } catch (error) {
      return handleHookError(error, this.name, "processToolsListRequest", {
        resultType: "continue" as const,
        request: request,
      });
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
      return await this.client.processToolsListResponse.mutate({
        response,
        originalRequest,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processToolsListResponse", {
        resultType: "continue" as const,
        response: response,
      });
    }
  }

  /**
   * Process an exception through the hook
   */
  async processToolException(
    error: unknown,
    originalToolCall: CallToolRequest,
  ): Promise<unknown> {
    try {
      return await this.client.processToolException.mutate({
        error,
        originalToolCall,
      });
    } catch (clientError) {
      return handleHookError(clientError, this.name, "processToolException", {
        resultType: "continue",
        body: null,
      });
    }
  }

  /**
   * Process a tool call transport error through the hook
   */
  async processToolCallTransportError(
    error: TransportError,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallTransportErrorHookResult> {
    try {
      return await this.client.processToolCallTransportError.mutate({
        error,
        originalToolCall,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processToolCallTransportError",
        {
          resultType: "continue" as const,
          error,
        },
      );
    }
  }

  /**
   * Process a tools/list transport error through the hook
   */
  async processToolsListTransportError(
    error: TransportError,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsTransportErrorHookResult> {
    try {
      return await this.client.processToolsListTransportError.mutate({
        error,
        originalRequest,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processToolsListTransportError",
        {
          resultType: "continue" as const,
          error,
        },
      );
    }
  }

  /**
   * Process an initialize transport error through the hook
   */
  async processInitializeTransportError(
    error: TransportError,
    originalRequest: InitializeRequest,
  ): Promise<InitializeTransportErrorHookResult> {
    try {
      return await this.client.processInitializeTransportError.mutate({
        error,
        originalRequest,
      });
    } catch (clientError) {
      return handleHookError(
        clientError,
        this.name,
        "processInitializeTransportError",
        {
          resultType: "continue" as const,
          error,
        },
      );
    }
  }

  /**
   * Process an initialize request through the hook
   */
  async processInitializeRequest(
    request: InitializeRequest,
  ): Promise<InitializeRequestHookResult> {
    try {
      return await this.client.processInitializeRequest.mutate(request);
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
  async processInitializeResponse(
    response: InitializeResult,
    originalRequest: InitializeRequest,
  ): Promise<InitializeResponseHookResult> {
    try {
      return await this.client.processInitializeResponse.mutate({
        response,
        originalRequest,
      });
    } catch (error) {
      return handleHookError(error, this.name, "processInitializeResponse", {
        resultType: "continue" as const,
        response: response,
      });
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
