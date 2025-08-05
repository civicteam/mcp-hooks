/**
 * This file holds all the context between transports and protocol layers
 * in the passthrough proxy.
 */

import { MethodsWithRequestType } from "@civic/hook-common";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type ClientResult,
  ClientResultSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  InitializeResult,
  type ListToolsRequest,
  ListToolsRequestSchema,
  McpError,
  type Notification,
  type Request,
  type ServerResult,
  ServerResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PassthroughClient } from "../client/passthroughClient.js";
import { HookChain } from "../hook/hookChain.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hook/processor.js";
import type { HookDefinition } from "../proxy/config.js";
import { PassthroughServer } from "../server/passthroughServer.js";
import { createAbortException } from "./mcpErrorUtils.js";
/**
 * Context that manages and coordinates multiple PassthroughTransports.
 * Provides a centralized place for transports to communicate and share state.
 */
export class PassthroughContext {
  private _passthroughServer: PassthroughServer;
  private _passthroughClient: PassthroughClient;
  private _hookChain: HookChain;

  get passthroughServer(): PassthroughServer {
    return this._passthroughServer;
  }

  get passthroughClient(): PassthroughClient {
    return this._passthroughClient;
  }

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

    this._passthroughServer.onclose = this._onServerClose.bind(this);
    this._passthroughClient.onclose = this._onClientClose.bind(this);
  }

  private _onerror(error: Error): void {
    this.onerror?.(error);
  }

  private addMetaToRequest(request: Request): Request {
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

  private addMetaToResult(result: ServerResult): ServerResult {
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

  private async processServerRequest(
    request: Request,
    hookRequestMethodName: string,
    hookResponseMethodName: string,
  ): Promise<ServerResult> {
    // Annotate request
    const annotatedRequest = this.addMetaToRequest(request);

    // pass request through chain
    const requestResult = await processRequestThroughHooks(
      annotatedRequest,
      this._hookChain.head,
      hookRequestMethodName,
    );

    let response: ServerResult | undefined = undefined;

    if (requestResult.resultType === "abort") {
      throw createAbortException("request", requestResult.reason);
    }

    if (requestResult.resultType === "respond") {
      response = requestResult.response as ServerResult;
    } else {
      // (requestResult.resultType === "continue")
      response = await this._passthroughClient.request(
        requestResult.request,
        ServerResultSchema,
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
  ): Promise<ServerResult> {
    return this.processServerRequest(
      request,
      "processInitializeRequest",
      "processInitializeResponse",
    );
  }

  private async _onServerListToolsRequest(
    request: ListToolsRequest,
  ): Promise<ServerResult> {
    return this.processServerRequest(
      request,
      "processToolsListRequest",
      "processToolsListResponse",
    );
  }

  private async _onServerRequest(request: Request): Promise<ServerResult> {
    // pass request through chain
    return this.processServerRequest(
      request,
      "processToolCallRequest",
      "processToolCallResponse",
    );
  }

  private async _onServerNotification(notification: Notification) {
    // for now, just directly pass through
    return this._passthroughClient.notification(notification);
  }

  private async _onClientRequest(request: Request): Promise<ClientResult> {
    // for now, directly pass through
    return this._passthroughServer.request(request, ClientResultSchema);
  }

  private async _onClientNotification(notification: Notification) {
    // for now, directly pass through
    return this._passthroughServer.notification(notification);
  }

  private _onServerClose(): void {
    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => this._passthroughClient.close())
      .catch((error) =>
        this._onerror(
          new Error(`Error trying to close the Passthrough Client: ${error}`),
        ),
      );
  }

  private _onClientClose(): void {
    // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
    Promise.resolve()
      .then(() => this._passthroughServer.close())
      .catch((error) =>
        this._onerror(
          new Error(`Error trying to close the Passthrough Server: ${error}`),
        ),
      );
  }

  /**
   * Attaches to the given server and client transport, starts it, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  async connect(
    serverTransport: Transport,
    clientTransport: Transport,
  ): Promise<void> {
    await this._passthroughServer.connect(serverTransport);
    await this._passthroughClient.connect(clientTransport);
  }

  /**
   * Clean up resources and close both transports
   */
  async close(): Promise<void> {
    // Close both transports
    await Promise.all([
      this._passthroughServer.close(),
      this._passthroughClient.close(),
    ]);
  }
}
