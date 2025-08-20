/**
 * This file holds all the context between transports and protocol layers
 * in the passthrough proxy.
 */

import type {
  HookChainError,
  MethodsWithErrorType,
  MethodsWithRequestType,
  MethodsWithResponseType,
  RequestExtra,
} from "@civic/hook-common";
import type {
  RequestHandlerExtra,
  RequestOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  type EmptyResult,
  EmptyResultSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type InitializeResult,
  InitializeResultSchema,
  type ListResourceTemplatesRequest,
  ListResourceTemplatesRequestSchema,
  type ListResourceTemplatesResult,
  ListResourceTemplatesResultSchema,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  ListResourcesResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
  McpError,
  type Notification,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type ReadResourceResult,
  ReadResourceResultSchema,
  type Request,
  type Result,
  ResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { ERROR_MESSAGES, MCP_ERROR_CODES } from "../error/errorCodes.js";
import { createAbortException } from "../error/mcpErrorUtils.js";
import { HookChain } from "../hook/hookChain.js";
import {
  processNotificationThroughHooks,
  processRequestThroughHooks,
  processResponseThroughHooks,
  toHookChainError,
} from "../hook/processor.js";
import type { HookDefinition } from "../proxy/config.js";
import { MetadataHelper } from "./metadataHelper.js";
import { PassthroughEndpoint } from "./passthroughEndpoint.js";

/**
 * Options for configuring PassthroughContext behavior
 */
export interface PassthroughContextOptions {
  /**
   * Whether to append metadata to requests (default: true)
   */
  appendMetadataToRequest?: boolean;
  /**
   * Whether to append metadata to responses (default: true)
   */
  appendMetadataToResponse?: boolean;
  /**
   * Whether to append metadata to notifications (default: true)
   */
  appendMetadataToNotification?: boolean;
}

/**
 * Interface for transport communication (used for both source and target)
 */
export interface TransportInterface {
  /**
   * Send a request through the transport
   * @param request The request to send
   * @param resultSchema Schema for validating the response
   * @param options Optional request options
   * @throws McpError if transport is not connected
   */
  request<T extends z.ZodSchema<object>>(
    request: Request,
    resultSchema: T,
    options?: RequestOptions,
  ): Promise<z.infer<T>>;

  /**
   * Send a notification through the transport
   * @param notification The notification to send
   * @throws McpError if transport is not connected
   */
  notification(notification: Notification): Promise<void>;

  /**
   * Send a ping request through the transport
   * @param options Optional request options
   * @throws McpError if transport is not connected
   */
  ping(options?: RequestOptions): Promise<EmptyResult>;

  /**
   * Get the underlying transport instance
   * @returns The transport instance or undefined if not connected
   */
  transport(): Transport | undefined;
}

/**
 * Context that manages and coordinates multiple PassthroughTransports.
 * Provides a centralized place for transports to communicate and share state.
 */
export class PassthroughContext {
  private _passthroughServer: PassthroughEndpoint;
  private _passthroughClient: PassthroughEndpoint;
  private _hookChain: HookChain;
  private _metadataHelper: MetadataHelper;
  private _options: Required<PassthroughContextOptions>;

  /**
   * Source interface for sending requests and notifications to connected clients
   */
  get source(): TransportInterface {
    return {
      request: this._sourceRequest.bind(this),
      notification: this._sourceNotification.bind(this),
      ping: this._sourcePing.bind(this),
      transport: this._sourceTransport.bind(this),
    };
  }

  /**
   * Target interface for sending requests and notifications to the target server
   */
  get target(): TransportInterface {
    return {
      request: this._targetRequest.bind(this),
      notification: this._targetNotification.bind(this),
      ping: this._targetPing.bind(this),
      transport: this._targetTransport.bind(this),
    };
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

  constructor(
    hooks?: HookDefinition[],
    options: PassthroughContextOptions = {},
  ) {
    // Set default options
    this._options = {
      appendMetadataToRequest: options.appendMetadataToRequest ?? true,
      appendMetadataToResponse: options.appendMetadataToResponse ?? true,
      appendMetadataToNotification:
        options.appendMetadataToNotification ?? true,
    };

    this._hookChain = new HookChain(hooks);
    this._metadataHelper = new MetadataHelper(
      this._options.appendMetadataToRequest,
      this._options.appendMetadataToResponse,
      this._options.appendMetadataToNotification,
    );

    this._passthroughServer = new PassthroughEndpoint(
      this._onServerRequest.bind(this),
      this._onServerNotification.bind(this),
    );
    this._passthroughClient = new PassthroughEndpoint(
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

    this._passthroughServer.setRequestHandler(
      ListResourcesRequestSchema,
      this._onServerListResourcesRequest.bind(this),
    );

    this._passthroughServer.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      this._onServerListResourceTemplatesRequest.bind(this),
    );

    this._passthroughServer.setRequestHandler(
      ReadResourceRequestSchema,
      this._onServerReadResourceRequest.bind(this),
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
    return this._metadataHelper.addMetadataToRequest(
      request,
      this._passthroughClient.transport?.sessionId,
      this._passthroughServer.transport?.sessionId,
    );
  }

  private addMetaToResult<TResult extends Result>(result: TResult): TResult {
    return this._metadataHelper.addMetadataToResult(
      result,
      this._passthroughClient.transport?.sessionId,
      this._passthroughServer.transport?.sessionId,
    );
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
    TErrorMethodName extends MethodsWithErrorType<TRequest>,
  >(
    request: TRequest,
    requestExtra: RequestExtra,
    responseSchema: TResponseSchema,
    hookRequestMethodName: TRequestMethodName,
    hookResponseMethodName: TResponseMethodName,
    hookErrorMethodName: TErrorMethodName,
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
      requestExtra,
      this._hookChain.tail, // Start from tail instead of head
      hookRequestMethodName,
      "reverse", // Process in reverse direction
    );

    let response: TResponse | null = null;
    let error: HookChainError | null = null;

    if (requestResult.resultType === "respond") {
      response = requestResult.response;
    } else if (requestResult.resultType === "abort") {
      error = requestResult.error;
    } else {
      // (requestResult.resultType === "continue")
      // Forward the request to the actual server
      if (!this._passthroughServer.transport) {
        throw new McpError(
          MCP_ERROR_CODES.REQUEST_REJECTED,
          "No server transport connected. Cannot forward request to target server.",
        );
      }
      try {
        response = await this._passthroughServer.request(
          requestResult.request,
          responseSchema,
        );
      } catch (e) {
        error = toHookChainError(e);
      }
    }

    let annotatedResponse: TResponse | null = null;
    if (response) {
      annotatedResponse = this.addMetaToResult(response);
    }

    // Process response through hooks (also in reverse, from last processed hook back)
    const responseResult = await processResponseThroughHooks(
      annotatedResponse,
      error,
      annotatedRequest,
      requestExtra,
      requestResult.lastProcessedHook,
      hookResponseMethodName,
      hookErrorMethodName,
      "forward", // Process in reverse direction
    );

    if (responseResult.resultType === "abort") {
      throw createAbortException(responseResult.error);
    }

    return responseResult.response;
  }

  private async processServerRequest<
    TRequest extends Request,
    TResponse extends Result,
    TResponseSchema extends z.ZodSchema<TResponse>,
    TRequestMethodName extends MethodsWithRequestType<TRequest>,
    TResponseMethodName extends MethodsWithResponseType<TResponse, TRequest>,
    TErrorMethodName extends MethodsWithErrorType<TRequest>,
  >(
    request: TRequest,
    requestExtra: RequestExtra,
    responseSchema: TResponseSchema,
    hookRequestMethodName: TRequestMethodName,
    hookResponseMethodName: TResponseMethodName,
    hookErrorMethodName: TErrorMethodName,
  ): Promise<TResponse> {
    // Annotate request
    const annotatedRequest = this.addMetaToRequest<TRequest>(request);

    // pass request through chain
    const requestResult = await processRequestThroughHooks<
      TRequest,
      TResponse,
      TRequestMethodName
    >(
      annotatedRequest,
      requestExtra,
      this._hookChain.head,
      hookRequestMethodName,
    );

    let response: TResponse | undefined = undefined;
    let error: HookChainError | null = null;

    if (requestResult.resultType === "respond") {
      response = requestResult.response;
    } else if (requestResult.resultType === "abort") {
      error = requestResult.error;
    } else {
      // (requestResult.resultType === "continue")
      // Check if client transport is connected before forwarding request
      if (!this._passthroughClient.transport) {
        throw new McpError(
          MCP_ERROR_CODES.REQUEST_REJECTED,
          ERROR_MESSAGES.NO_CLIENT_TRANSPORT,
        );
      }
      try {
        response = await this._passthroughClient.request(
          requestResult.request,
          responseSchema,
        );
      } catch (e) {
        error = toHookChainError(e);
      }
    }

    let annotatedResponse: TResponse | null = null;
    if (response) {
      annotatedResponse = this.addMetaToResult(response);
    }

    // pass response through chain
    const responseResult = await processResponseThroughHooks(
      annotatedResponse,
      error,
      annotatedRequest,
      requestExtra,
      requestResult.lastProcessedHook,
      hookResponseMethodName,
      hookErrorMethodName,
    );

    if (responseResult.resultType === "abort") {
      throw createAbortException(responseResult.error);
    }

    return responseResult.response;
  }

  private async _onServerInitializeRequest(
    request: InitializeRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<InitializeResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      InitializeResultSchema,
      "processInitializeRequest",
      "processInitializeResult",
      "processInitializeError",
    );
  }

  private async _onServerListToolsRequest(
    request: ListToolsRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<ListToolsResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      ListToolsResultSchema,
      "processListToolsRequest",
      "processListToolsResult",
      "processListToolsError",
    );
  }

  private async _onServerCallToolRequest(
    request: CallToolRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<CallToolResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      CallToolResultSchema as z.ZodSchema<CallToolResult>, // TODO: The cast here should NOT be required.
      "processCallToolRequest",
      "processCallToolResult",
      "processCallToolError",
    );
  }

  private async _onServerListResourcesRequest(
    request: ListResourcesRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<ListResourcesResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      ListResourcesResultSchema,
      "processListResourcesRequest",
      "processListResourcesResult",
      "processListResourcesError",
    );
  }

  private async _onServerListResourceTemplatesRequest(
    request: ListResourceTemplatesRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<ListResourceTemplatesResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      ListResourceTemplatesResultSchema,
      "processListResourceTemplatesRequest",
      "processListResourceTemplatesResult",
      "processListResourceTemplatesError",
    );
  }

  private async _onServerReadResourceRequest(
    request: ReadResourceRequest,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<ReadResourceResult> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      ReadResourceResultSchema,
      "processReadResourceRequest",
      "processReadResourceResult",
      "processReadResourceError",
    );
  }

  private async _onServerRequest(
    request: Request,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<Result> {
    // all other calls are just forwarded to the client
    if (!this._passthroughClient.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        ERROR_MESSAGES.NO_CLIENT_TRANSPORT,
      );
    }

    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processServerRequest(
      request,
      requestExtra,
      ResultSchema,
      "processOtherRequest",
      "processOtherResult",
      "processOtherError",
    );
  }

  /**
   * Handle notifications from the server (client -> server direction)
   * Process through hooks and forward to the upstream server if not aborted
   */
  private async _onServerNotification(notification: Notification) {
    try {
      // Add metadata to the notification
      const annotatedNotification =
        this._metadataHelper.addMetadataToNotification(
          notification,
          this._passthroughServer.transport?.sessionId,
        );

      // Process notification through hooks
      const result = await processNotificationThroughHooks(
        annotatedNotification,
        this._hookChain.head,
        "processNotification",
      );

      // If aborted by hooks, log and return (notifications can't return errors)
      if (result.resultType === "abort") {
        this._onerror(
          new Error(`Notification aborted by hook: ${result.error.message}`),
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
  private async _onClientRequest(
    request: Request,
    requestHandlerExtra: RequestHandlerExtra<Request, Notification>,
  ): Promise<Result> {
    const requestExtra: RequestExtra = {
      requestId: requestHandlerExtra.requestId,
      sessionId: requestHandlerExtra.sessionId,
    };
    return this.processClientRequest(
      request,
      requestExtra,
      ResultSchema,
      "processTargetRequest",
      "processTargetResult",
      "processTargetError",
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
      const annotatedNotification =
        this._metadataHelper.addMetadataToNotification(
          notification,
          this._passthroughServer.transport?.sessionId,
        );

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
          new Error(
            `Client notification aborted by hook: ${result.error.message}`,
          ),
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
   * Send a request through the source (server) transport
   * @private
   */
  private async _sourceRequest<T extends z.ZodSchema<object>>(
    request: Request,
    resultSchema: T,
    options?: RequestOptions,
  ): Promise<z.infer<T>> {
    if (!this._passthroughServer.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        "No server transport connected. Cannot send request through source interface.",
      );
    }
    return this._passthroughServer.request(request, resultSchema, options);
  }

  /**
   * Send a notification through the source (server) transport
   * @private
   */
  private async _sourceNotification(notification: Notification): Promise<void> {
    if (!this._passthroughServer.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        "No server transport connected. Cannot send notification through source interface.",
      );
    }
    return this._passthroughServer.notification(notification);
  }

  /**
   * Send a ping through the source (server) transport
   * @private
   */
  private async _sourcePing(options?: RequestOptions): Promise<EmptyResult> {
    return this._sourceRequest({ method: "ping" }, EmptyResultSchema, options);
  }

  /**
   * Send a request through the target (client) transport
   * @private
   */
  private async _targetRequest<T extends z.ZodSchema<object>>(
    request: Request,
    resultSchema: T,
    options?: RequestOptions,
  ): Promise<z.infer<T>> {
    if (!this._passthroughClient.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        "No client transport connected. Cannot send request through target interface.",
      );
    }
    return this._passthroughClient.request(request, resultSchema, options);
  }

  /**
   * Send a notification through the target (client) transport
   * @private
   */
  private async _targetNotification(notification: Notification): Promise<void> {
    if (!this._passthroughClient.transport) {
      throw new McpError(
        MCP_ERROR_CODES.REQUEST_REJECTED,
        "No client transport connected. Cannot send notification through target interface.",
      );
    }
    return this._passthroughClient.notification(notification);
  }

  /**
   * Send a ping through the target (client) transport
   * @private
   */
  private async _targetPing(options?: RequestOptions): Promise<EmptyResult> {
    return this._targetRequest({ method: "ping" }, EmptyResultSchema, options);
  }

  /**
   * Get the source (server) transport instance
   * @private
   */
  private _sourceTransport(): Transport | undefined {
    return this._passthroughServer.transport;
  }

  /**
   * Get the target (client) transport instance
   * @private
   */
  private _targetTransport(): Transport | undefined {
    return this._passthroughClient.transport;
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
