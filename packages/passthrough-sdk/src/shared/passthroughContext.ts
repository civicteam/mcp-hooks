/**
 * This file holds all the context between transports and protocol layers
 * in the passthrough proxy.
 */

import {
  type ClientResult,
  ClientResultSchema,
  type Notification,
  type Request,
  type ServerResult,
  ServerResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PassthroughClient } from "../client/passthroughClient.js";
import { PassthroughServer } from "../server/passthroughServer.js";
import { PassthroughSessionContext } from "./passthroughSessionContext.js";
import type {
  ClientPassthroughTransport,
  ServerPassthroughTransport,
} from "./passthroughTransport.js";

/**
 * Context that manages and coordinates multiple PassthroughTransports.
 * Provides a centralized place for transports to communicate and share state.
 */
export class PassthroughContext {
  private _sessionContext: PassthroughSessionContext;
  private _passthroughServer: PassthroughServer;
  private _passthroughClient: PassthroughClient;

  constructor() {
    this._sessionContext = new PassthroughSessionContext();
    this._passthroughServer = new PassthroughServer(
      this._onServerRequest.bind(this),
      this._onServerNotification.bind(this),
    );
    this._passthroughClient = new PassthroughClient(
      this._onClientRequest.bind(this),
      this._onClientNotification.bind(this),
    );
  }

  private _onServerRequest(request: Request): Promise<ServerResult> {
    // for now, just directly pass through
    return this._passthroughClient.request(request, ServerResultSchema);
  }

  private _onServerNotification(notification: Notification) {
    // for now, just directly pass through

    return this._passthroughClient.notification(notification);
  }

  private _onClientRequest(request: Request): Promise<ClientResult> {
    // for now, directly pass through

    return this._passthroughServer.request(request, ClientResultSchema);
  }

  private _onClientNotification(notification: Notification) {
    // for now, directly pass through

    return this._passthroughServer.notification(notification);
  }

  /**
   * Get the session context
   */
  get sessionContext(): PassthroughSessionContext {
    return this._sessionContext;
  }

  /**
   * Attaches to the given server and client transport, starts it, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  async connect(
    serverTransport: ServerPassthroughTransport,
    clientTransport: ClientPassthroughTransport,
  ): Promise<void> {
    // Set the context reference on both transports
    serverTransport.context = this;
    clientTransport.context = this;

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
