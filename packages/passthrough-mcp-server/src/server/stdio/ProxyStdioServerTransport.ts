/**
 * ProxyStdioServerTransport
 *
 * A StdioServerTransport subclass that forwards messages through a MessageHandler
 * to a remote MCP server.
 */

import type {
  JSONRPCError,
  JSONRPCMessage,
    Request,
    Notification,
    Result,
    ServerRequest,
    ServerNotification,
    ServerResult,
} from "@modelcontextprotocol/sdk/types.js";
import {Protocol} from "@modelcontextprotocol/sdk/shared/protocol.js";
import {Transport} from "@modelcontextprotocol/sdk/shared/transport.js";

import type { Config } from "../../lib/config.js";
import type { HttpErrorResponse } from "../../lib/hooks/index.js";
import { logger } from "../../lib/logger.js";
import { MessageHandler } from "../messageHandler.js";
import { establishSSEConnection } from "./sseConnection.js";

export class ProxyServer<
    RequestT extends Request = Request,
    NotificationT extends Notification = Notification,
    ResultT extends Result = Result,
> extends Protocol<
    ServerRequest | RequestT,
    ServerNotification | NotificationT,
    ServerResult | ResultT
> {
  private messageHandler: MessageHandler;
  private authHeaders: Record<string, string> = {};
  private sessionId: string | undefined;
  private config: Config;

  constructor(config: Config) {
    super();
    this.config = config;
    this.messageHandler = new MessageHandler(config);

    // Extract auth headers from config
    if (config.authToken) {
      this.authHeaders.authorization = `Bearer ${config.authToken}`;
    }
  }


  // Overwrite connect
  async connect(transport: Transport): Promise<void> {
    // set an onmessage callback (that will be left in place by the protocol)
    transport.onmessage = this.handleMessage.bind(this);

    await super.connect(transport)
  }


  /**
   * Handle incoming messages by forwarding them to the remote server
   */
  private async handleMessage(message: JSONRPCMessage): Promise<void> {
    logger.info(
      `[ProxyStdioServerTransport] Received message: ${JSON.stringify(message)}`,
    );

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
        `[ProxyStdioServerTransport] Stored session ID: ${this.sessionId}`,
      );

      // Establish SSE connection for receiving server-initiated messages
      establishSSEConnection(
        this.config,
        this.sessionId,
        this.authHeaders,
        this,
      ).catch((error) => {
        logger.error(
          `[ProxyStdioServerTransport] Failed to establish SSE connection: ${error}`,
        );
      });
    }

    logger.info(
      `[ProxyStdioServerTransport] Sending response: ${JSON.stringify(result.message)}`,
    );

    // Send the response back through stdio
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
        await this.transport.send(jsonRpcError);
      } else {
        // Regular JSON-RPC message
        await this.transport.send(result.message as JSONRPCMessage);
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
