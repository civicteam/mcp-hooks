/**
 * This file holds all the context between transports and protocol layers
 * in the passthrough proxy.
 */

import {
  MethodsWithRequestType,
  MethodsWithResponseType
} from "@civic/hook-common";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequest, CallToolRequestSchema,
  CallToolResult, CallToolResultSchema,
  type InitializeRequest,
  InitializeRequestSchema, InitializeResult,
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
import { PassthroughClient } from "../client/passthroughClient.js";
import { ERROR_MESSAGES, MCP_ERROR_CODES } from "../error/errorCodes.js";
import { createAbortException } from "../error/mcpErrorUtils.js";
import { HookChain } from "../hook/hookChain.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hook/processor.js";
import type { HookDefinition } from "../proxy/config.js";
import { PassthroughServer } from "../server/passthroughServer.js";
import {z} from "zod";
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

  private addMetaToRequest<TRequest extends Request>(request: TRequest): TRequest {
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

  private async processServerRequest<
      TRequest extends Request,
      TResponse extends Result,
      TResponseSchema extends z.ZodSchema<TResponse>,
      TRequestMethodName extends MethodsWithRequestType<TRequest>,
      TResponseMethodName extends MethodsWithResponseType<TResponse, TRequest>
  >(
    request: TRequest,
    responseSchema: TResponseSchema,
    hookRequestMethodName: TRequestMethodName,
    hookResponseMethodName: TResponseMethodName,
  ): Promise<TResponse> {
    // Annotate request
    const annotatedRequest = this.addMetaToRequest<TRequest>(request);

    // pass request through chain
    const requestResult = await processRequestThroughHooks<TRequest, TResponse, TRequestMethodName>(
      annotatedRequest,
      this._hookChain.head,
      hookRequestMethodName,
    );

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
      "processInitializeResponse"
    );
  }

  private async _onServerListToolsRequest(
    request: ListToolsRequest,
  ): Promise<ListToolsResult> {
    return this.processServerRequest(
      request,
        ListToolsResultSchema,
      "processToolsListRequest",
      "processToolsListResponse"
    );
  }

  private async _onServerCallToolRequest(
      request: CallToolRequest,
  ): Promise<CallToolResult> {
    return this.processServerRequest(
        request,
        CallToolResultSchema as z.ZodSchema<CallToolResult>, // TODO: The cast here should NOT be required.
        "processToolCallRequest",
        "processToolCallResponse"
    );
  }

  private async _onServerRequest(request: Request): Promise<ServerResult> {
    // all other calls are just forwarded to the client
    if (!this._passthroughClient.transport) {
      throw new McpError(
          MCP_ERROR_CODES.REQUEST_REJECTED,
          ERROR_MESSAGES.NO_CLIENT_TRANSPORT,
      );
    }

    return this._passthroughClient.request(request, ServerResultSchema);
  }

  private async _onServerNotification(notification: Notification) {
    // TODO: Needs to be supported by hooks.
    // Check if client transport is connected before forwarding notification
    if (!this._passthroughClient.transport) {
      // For notifications, we can't throw an error back, so we log and return
      this._onerror(new Error(ERROR_MESSAGES.NO_CLIENT_TRANSPORT_NOTIFICATION));
      return;
    }
    // for now, just directly pass through
    return this._passthroughClient.notification(notification);
  }

  private async _onClientRequest(request: Request): Promise<Result> {
    // TODO: Needs to be supported by hooks.
    // for now, directly pass through
    return this._passthroughServer.request(request, ResultSchema);
  }

  private async _onClientNotification(notification: Notification) {
    // TODO: Needs to be supported by hooks.
    // for now, directly pass through
    return this._passthroughServer.notification(notification);
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
