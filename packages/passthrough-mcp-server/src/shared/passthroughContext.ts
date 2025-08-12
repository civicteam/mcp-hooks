/**
 * This file holds all the context between transports and protocol layers
 * in the passthrough proxy.
 */

import type {
  MethodsWithRequestType,
  MethodsWithResponseType,
} from "@civic/hook-common";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type InitializeResult,
  InitializeResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
  McpError,
  type Notification,
  type Request,
  type Result,
  ResultSchema,
  type ServerResult,
  ServerResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { PassthroughClient } from "../client/passthroughClient.js";
import { ERROR_MESSAGES, MCP_ERROR_CODES } from "../error/errorCodes.js";
import { createAbortException } from "../error/mcpErrorUtils.js";
import { HookChain } from "../hook/hookChain.js";
import {
  processNotificationThroughHooks,
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hook/processor.js";
import type { HookDefinition } from "../proxy/config.js";
import { PassthroughServer } from "../server/passthroughServer.js";
/**
 * Context that manages and coordinates multiple PassthroughTransports.
 * Provides a centralized place for transports to communicate and share state.
 */
export class PassthroughContext {
  private _passthroughServer: PassthroughServer;
  private _passthroughClient: PassthroughClient;
  private _hookChain: HookChain;

  get passthroughServerTransport(): Transport | undefined {
    return this._passthroughServer.transport;
  }

  get passthroughClientTransport(): Transport | undefined {
    return this._passthroughClient.transport;
  }

  /**
   * Callback for when the connection is closed for any reason.
   *
   * This is invoked when close() is called as well.
   */
  onclose?: () => void;

  /**
   * Callback for when an error occurs.
   *
   * Note that errors are not necessarily fatal; they are used for reporting any kind of exceptional condition out of band.
   */
  onerror?: (error: Error) => void;

  constructor(hooks?: HookDefinition[]) {
    this._hookChain = new HookChain(hooks);

    this._passthroughServer = new PassthroughServer(
      this._onServerRequest.bind(this),
      this._onServerNotification.bind(this),
    );
    this._passthroughClient = new PassthroughClient(
      this._onClientRequest.bind(this),
      this._onClientNotification.bind(this),
    );

    // Special Handler for Client Initialization and ToolList
    this._passthroughServer.setRequestHandler(
      InitializeRequestSchema,
      this._onServerInitializeRequest.bind(this),
    );
    this._passthroughServer.setRequestHandler(
      ListToolsRequestSchema,
      this._onServerListToolsRequest.bind(this),
    );

    this._passthroughServer.setRequestHandler(
      CallToolRequestSchema,
      this._onServerCallToolRequest.bind(this),
    );

    this._passthroughServer.onclose = this._onServerClose.bind(this);
    this._passthroughClient.onclose = this._onClientClose.bind(this);
  }

  private _onerror(error: Error): void {
    this.onerror?.(error);
  }

  private addMetaToRequest<TRequest extends Request>(
    request: TRequest,
  ): TRequest {
    return {
      ...request,
      params: {
        ...request.params,
        _meta: {
          ...request.params?._meta,
          sessionId: this.passthroughServerTransport?.sessionId,
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      },
    };
  }

  private addMetaToResult<TResult extends Result>(result: TResult): TResult {
    return {
      ...result,
      _meta: {
        ...result._meta,
        sessionId: this.passthroughClientTransport?.sessionId,
        timestamp: new Date().toISOString(),
        source: "passthrough-server",
      },
    };
  }

  /**
   * Process client requests (target server -> client direction) through hooks in reverse order
   *
   * Why reverse order:
   * - Client requests flow from target server back to client (reverse direction)
   * - Hooks should process in reverse to maintain symmetry with server requests
   * - This ensures proper "unwrapping" of transformations applied during server->client flow
   */
  private async processClientRequest<
    TRequest extends Request,
    TResponse extends Result,
    TResponseSchema extends z.ZodSchema<TResponse>,
    TRequestMethodName extends MethodsWithRequestType<TRequest>,
    TResponseMethodName extends MethodsWithResponseType<TResponse, TRequest>,
  >(
    request: TRequest,
    responseSchema: TResponseSchema,
    hookRequestMethodName: TRequestMethodName,
    hookResponseMethodName: TResponseMethodName,
  ): Promise<TResponse> {
    // Annotate request with metadata
    const annotatedRequest = this.addMetaToRequest<TRequest>(request);

    // Process request through hooks IN REVERSE ORDER (tail to head)
    const requestResult = await processRequestThroughHooks<
      TRequest,
      TResponse,
      TRequestMethodName
    >(
      annotatedRequest,
      this._hookChain.tail, // Start from tail instead of head
      hookRequestMethodName,
      "reverse", // Process in reverse direction
    );

    let response: TResponse | undefined = undefined;

    if (requestResult.resultType === "abort") {
      throw createAbortException("request", requestResult.reason);
    }

    if (requestResult.resultType === "respond") {
      response = requestResult.response;
    } else {
      // (requestResult.resultType === "continue")
      // Forward the request to the actual server
      if (!this._passthroughServer.transport) {
        throw new McpError(
          MCP_ERROR_CODES.REQUEST_REJECTED,
          "No server transport connected. Cannot forward request to target server.",
        );
      }
      response = await this._passthroughServer.request(
        requestResult.request,
        responseSchema,
      );
    }

    const annotatedResponse = this.addMetaToResult(response);

    // Process response through hooks (also in reverse, from last processed hook back)
    const responseResult = await processResponseThroughHooks(
      annotatedResponse,
      annotatedRequest,
      requestResult.lastProcessedHook,
      hookResponseMethodName,
      "forward", // Process in reverse direction
    );

    if (responseResult.resultType === "abort") {
      throw createAbortException("response", responseResult.reason);
    }

    return responseResult.response;
  }

  private async processServerRequest<
    TRequest extends Request,
    TResponse extends Result,
    TResponseSchema extends z.ZodSchema<TResponse>,
    TRequestMethodName extends MethodsWithRequestType<TRequest>,
    TResponseMethodName extends MethodsWithResponseType<TResponse, TRequest>,
  >(
    request: TRequest,
    responseSchema: TResponseSchema,
    hookRequestMethodName: TRequestMethodName,
    hookResponseMethodName: TResponseMethodName,
  ): Promise<TResponse> {
    // Annotate request
    const annotatedRequest = this.addMetaToRequest<TRequest>(request);

    // pass request through chain
    const requestResult = await processRequestThroughHooks<
      TRequest,
      TResponse,
      TRequestMethodName
    >(annotatedRequest, this._hookChain.head, hookRequestMethodName);

    let response: TResponse | undefined = undefined;

    if (requestResult.resultType === "abort") {
      throw createAbortException("request", requestResult.reason);
    }

    if (requestResult.resultType === "respond") {
      response = requestResult.response;
    } else {
      // (requestResult.resultType === "continue")
      // Check if client transport is connected before forwarding request
      if (!this._passthroughClient.transport) {
        throw new McpError(
          MCP_ERROR_CODES.REQUEST_REJECTED,
          ERROR_MESSAGES.NO_CLIENT_TRANSPORT,
        );
      }
      response = await this._passthroughClient.request(
        requestResult.request,
        responseSchema,
      );
    }

    const annotatedResponse = this.addMetaToResult(response);

    // pass response through chain
    const responseResult = await processResponseThroughHooks(
      annotatedResponse,
      annotatedRequest,
      requestResult.lastProcessedHook,
      hookResponseMethodName,
    );

    if (responseResult.resultType === "abort") {
      throw createAbortException("response", responseResult.reason);
    }

    return responseResult.response;
  }

  private async _onServerInitializeRequest(
    request: InitializeRequest,
  ): Promise<InitializeResult> {
    return this.processServerRequest(
      request,
      InitializeResultSchema,
      "processInitializeRequest",
      "processInitializeResponse",
    );
  }

  private async _onServerListToolsRequest(
    request: ListToolsRequest,
  ): Promise<ListToolsResult> {
    return this.processServerRequest(
      request,
      ListToolsResultSchema,
      "processToolsListRequest",
      "processToolsListResponse",
    );
  }

  private async _onServerCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolResult> {
    return this.processServerRequest(
      request,
      CallToolResultSchema as z.ZodSchema<CallToolResult>, // TODO: The cast here should NOT be required.
      "processToolCallRequest",
      "processToolCallResponse",
    );
  }

  private async _onServerRequest(request: Request): Promise<Result> {
    // all other calls are just forwarded to the client
    if (!this._passthroughClient.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        ERROR_MESSAGES.NO_CLIENT_TRANSPORT,
      );
    }

    return this.processServerRequest(
      request,
      ResultSchema,
      "processOtherRequest",
      "processOtherResponse",
    );
  }

  /**
   * Handle notifications from the server (client -> server direction)
   * Process through hooks and forward to the upstream server if not aborted
   */
  private async _onServerNotification(notification: Notification) {
    try {
      // Add metadata to the notification
      const annotatedNotification = {
        ...notification,
        params: {
          ...notification.params,
          _meta: {
            ...notification.params?._meta,
            sessionId: this.passthroughServerTransport?.sessionId,
            timestamp: new Date().toISOString(),
            source: "passthrough-server",
          },
        },
      };

      // Process notification through hooks
      const result = await processNotificationThroughHooks(
        annotatedNotification,
        this._hookChain.head,
        "processNotification",
      );

      // If aborted by hooks, log and return (notifications can't return errors)
      if (result.resultType === "abort") {
        this._onerror(
          new Error(`Notification aborted by hook: ${result.reason}`),
        );
        return;
      }

      // Check if client transport is connected before forwarding notification
      if (!this._passthroughClient.transport) {
        // For notifications, we can't throw an error back, so we log and return
        this._onerror(
          new Error(ERROR_MESSAGES.NO_CLIENT_TRANSPORT_NOTIFICATION),
        );
        return;
      }

      // Forward the (potentially modified) notification to the upstream server
      return this._passthroughClient.notification(result.notification);
    } catch (error) {
      // Log any unexpected errors (notifications can't return errors to caller)
      this._onerror(
        error instanceof Error
          ? error
          : new Error(`Notification processing error: ${error}`),
      );
    }
  }

  /**
   * Handle requests from the client (target server -> client direction)
   * Process through hooks in REVERSE order and forward to the target server if not aborted
   *
   * Why reverse order:
   * - Client requests come from the target server back to the client
   * - This is the "return journey" so hooks should process in reverse
   * - Maintains symmetry: server requests go head->tail, client requests go tail->head
   */
  private async _onClientRequest(request: Request): Promise<Result> {
    return this.processClientRequest(
      request,
      ResultSchema,
      "processTargetRequest",
      "processTargetResponse",
    );
  }

  /**
   * Handle notifications from the client (target server -> client direction)
   * Process through hooks in REVERSE order and forward to the target server if not aborted
   *
   * Why reverse order:
   * - Client notifications come from the target server back to the client
   * - This is the "return journey" so hooks should process in reverse
   * - Maintains symmetry: server notifications go head->tail, client notifications go tail->head
   */
  private async _onClientNotification(notification: Notification) {
    try {
      // Add metadata to the notification
      const annotatedNotification = {
        ...notification,
        params: {
          ...notification.params,
          _meta: {
            ...notification.params?._meta,
            sessionId: this.passthroughServerTransport?.sessionId,
            timestamp: new Date().toISOString(),
            source: "passthrough-server",
          },
        },
      };

      // Process notification through hooks IN REVERSE ORDER (tail to head)
      const result = await processNotificationThroughHooks(
        annotatedNotification,
        this._hookChain.tail,
        "processTargetNotification",
        "reverse",
      );

      // If aborted by hooks, log and return (notifications can't return errors)
      if (result.resultType === "abort") {
        this._onerror(
          new Error(`Client notification aborted by hook: ${result.reason}`),
        );
        return;
      }

      // Check if server transport is connected before forwarding notification
      if (!this._passthroughServer.transport) {
        // For notifications, we can't throw an error back, so we log and return
        this._onerror(
          new Error(
            "No server transport connected. Cannot forward client notification to target server.",
          ),
        );
        return;
      }

      // Forward the (potentially modified) notification to the target server
      return this._passthroughServer.notification(result.notification);
    } catch (error) {
      // Log any unexpected errors (notifications can't return errors to caller)
      this._onerror(
        error instanceof Error
          ? error
          : new Error(`Client notification processing error: ${error}`),
      );
    }
  }

  private _onServerClose(): void {
    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => this._passthroughClient.close())
      .catch((error) =>
        this._onerror(
          new Error(`${ERROR_MESSAGES.ERROR_CLOSING_CLIENT}: ${error}`),
        ),
      );
  }

  private _onClientClose(): void {
    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => this._passthroughServer.close())
      .catch((error) =>
        this._onerror(
          new Error(`${ERROR_MESSAGES.ERROR_CLOSING_SERVER}: ${error}`),
        ),
      );
  }

  /**
   * Attaches to the given server and optionally client transport, starts them, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   *
   * @param serverTransport The transport for the server connection (required)
   * @param clientTransport The transport for the client connection (optional)
   */
  async connect(
    serverTransport: Transport,
    clientTransport?: Transport,
  ): Promise<void> {
    await this._passthroughServer.connect(serverTransport);
    if (clientTransport) {
      await this._passthroughClient.connect(clientTransport);
    }
  }

  /**
   * Clean up resources and close both transports
   */
  async close(): Promise<void> {
    // Close both transports (safe even if client transport is not connected)
    await Promise.all([
      this._passthroughServer.close(),
      this._passthroughClient.close(),
    ]);
  }
}
