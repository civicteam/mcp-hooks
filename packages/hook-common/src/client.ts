import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import type {
  CallToolRequest,
  InitializeRequest,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { HookRouter } from "./router.js";
import type {
  Hook,
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
      console.error(`Hook ${this.name} request processing failed:`, error);
      // On error, continue with unmodified request
      return {
        resultType: "continue",
        request: toolCall,
      };
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
      console.error(`Hook ${this.name} response processing failed:`, error);
      // On error, continue with unmodified response
      return {
        resultType: "continue",
        response,
      };
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
      // Check if it's a "not implemented" error
      if (error instanceof Error && error.message.includes("not implemented")) {
        // Hook doesn't support this method, continue with unmodified request
        return {
          resultType: "continue",
          request: request,
        };
      }
      console.error(
        `Hook ${this.name} tools/list request processing failed:`,
        error,
      );
      // On other errors, continue with unmodified request
      return {
        resultType: "continue",
        request: request,
      };
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
      // Check if it's a "not implemented" error
      if (error instanceof Error && error.message.includes("not implemented")) {
        // Hook doesn't support this method, continue with unmodified response
        return {
          resultType: "continue",
          response: response,
        };
      }
      console.error(
        `Hook ${this.name} tools/list response processing failed:`,
        error,
      );
      // On other errors, continue with unmodified response
      return {
        resultType: "continue",
        response: response,
      };
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
      // Check if it's a "not implemented" error
      if (
        clientError instanceof Error &&
        clientError.message.includes("not implemented")
      ) {
        // Hook doesn't support this method, continue (don't handle exception)
        return {
          resultType: "continue",
          body: null,
        };
      }
      console.error(
        `Hook ${this.name} exception processing failed:`,
        clientError,
      );
      // On other errors, continue (don't handle exception)
      return {
        resultType: "continue",
        body: null,
      };
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
      // Check if it's a "not implemented" error
      if (
        clientError instanceof Error &&
        clientError.message.includes("not implemented")
      ) {
        // Hook doesn't support this method, continue with unmodified error
        return {
          resultType: "continue",
          error,
        };
      }
      console.error(
        `Hook ${this.name} tool call transport error processing failed:`,
        clientError,
      );
      // On other errors, continue with unmodified error
      return {
        resultType: "continue",
        error,
      };
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
      // Check if it's a "not implemented" error
      if (
        clientError instanceof Error &&
        clientError.message.includes("not implemented")
      ) {
        // Hook doesn't support this method, continue with unmodified error
        return {
          resultType: "continue",
          error,
        };
      }
      console.error(
        `Hook ${this.name} tools/list transport error processing failed:`,
        clientError,
      );
      // On other errors, continue with unmodified error
      return {
        resultType: "continue",
        error,
      };
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
      // Check if it's a "not implemented" error
      if (
        clientError instanceof Error &&
        clientError.message.includes("not implemented")
      ) {
        // Hook doesn't support this method, continue with unmodified error
        return {
          resultType: "continue",
          error,
        };
      }
      console.error(
        `Hook ${this.name} initialize transport error processing failed:`,
        clientError,
      );
      // On other errors, continue with unmodified error
      return {
        resultType: "continue",
        error,
      };
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
