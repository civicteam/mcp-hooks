/**
 * TransportProxyServer
 *
 * A generic forwarding Proxy Server that forwards messages through a MessageHandler
 * to a remote MCP server.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCError,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";

import type { TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../lib/config.js";
import type { HttpErrorResponse } from "../../lib/hooks/index.js";
import { logger } from "../../lib/logger.js";
import { MessageHandler } from "../messageHandler.js";
import { establishSSEConnection } from "./sseConnection.js";

export class TransportProxyServer {
  private _transport?: Transport;
  private messageHandler: MessageHandler;
  private authHeaders: Record<string, string> = {};
  private sessionId?: string;
  private config: Config;

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

  constructor(config: Config) {
    this.config = config;
    this.messageHandler = new MessageHandler(config);

    // Extract auth headers from config
    if (config.authToken) {
      this.authHeaders.authorization = `Bearer ${config.authToken}`;
    }
  }

  get transport(): Transport | undefined {
    return this._transport;
  }

  /**
   * Closes the connection.
   */
  async close(): Promise<void> {
    await this._transport?.close();
  }

  /**
   * Attaches to the given transport, starts it, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  /**
   * Attaches to the given transport, starts it, and starts listening for messages.
   *
   * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  async connect(transport: Transport): Promise<void> {
    this._transport = transport;
    const _onclose = this.transport?.onclose;
    this._transport.onclose = () => {
      _onclose?.();
      this._onclose();
    };

    const _onerror = this.transport?.onerror;
    this._transport.onerror = (error: Error) => {
      _onerror?.(error);
      this._onerror(error);
    };

    const _onmessage = this._transport?.onmessage;
    this._transport.onmessage = (message, extra) => {
      _onmessage?.(message, extra);

      this.handleMessage(message, extra).catch(this._onerror);
    };

    await this._transport.start();
  }

  private _onclose(): void {
    this._transport = undefined;
    this.onclose?.();
  }

  private _onerror(error: Error): void {
    logger.error(`[TransportProxyServer] Generic Error: ${error}`);

    this.onerror?.(error);
  }

  public async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    if (!this._transport) {
      logger.error(
        `[ProxyServer] Warning, attempted to send message before transport was connected. Ignoring message: ${JSON.stringify(message)}`,
      );
      return;
    }

    return this._transport.send(message, options);
  }

  /**
   * Handle incoming messages by forwarding them to the remote server
   */
  private async handleMessage(
    message: JSONRPCMessage,
    extra?: MessageExtraInfo,
  ): Promise<void> {
    logger.info(`[ProxyServer] Received message: ${JSON.stringify(message)}`);

    // Include session ID in headers if we have one
    const headers = { ...this.authHeaders };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }

    const result = await this.messageHandler.handle(message, headers);

    // Extract session ID from initialize response
    if (
      "method" in message &&
      message.method === "initialize" &&
      result.headers?.["mcp-session-id"]
    ) {
      this.sessionId = result.headers["mcp-session-id"];
      logger.info(
        `[TransportProxyServer] Stored session ID: ${this.sessionId}`,
      );

      // Establish SSE connection for receiving server-initiated messages
      establishSSEConnection(
        this.config,
        this.sessionId,
        this.authHeaders,
        this.send.bind(this),
      ).catch((error) => {
        logger.error(
          `[TransportProxyServer] Failed to establish SSE connection: ${error}`,
        );
      });
    }

    logger.info(
      `[TransportProxyServer] Sending response: ${JSON.stringify(result.message)}`,
    );

    // Send the response back through transport proxy
    if (result.message) {
      // Check if this is an HttpErrorResponse that needs conversion
      if (
        "statusCode" in result.message &&
        "body" in result.message &&
        !("jsonrpc" in result.message)
      ) {
        // Convert HttpErrorResponse to JSON-RPC error
        const httpError = result.message as HttpErrorResponse;
        const jsonRpcError: JSONRPCError = {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `HTTP ${httpError.statusCode}`,
            data: httpError.body,
          },
          id: "id" in message ? message.id : 0,
        };
        await this.send(jsonRpcError);
      } else {
        // Regular JSON-RPC message
        await this.send(result.message as JSONRPCMessage);
      }
    }
  }

  /**
   * Get the underlying MessageHandler instance
   */
  public getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }
}
