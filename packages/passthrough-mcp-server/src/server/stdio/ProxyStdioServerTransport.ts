/**
 * ProxyStdioServerTransport
 *
 * A StdioServerTransport subclass that forwards messages through a MessageHandler
 * to a remote MCP server.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  JSONRPCError,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../lib/config.js";
import type { HttpErrorResponse } from "../../lib/hooks/types.js";
import { logger } from "../../lib/logger.js";
import { MessageHandler } from "../messageHandler.js";
import { establishSSEConnection } from "./sseConnection.js";

export class ProxyStdioServerTransport extends StdioServerTransport {
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

    // Override onmessage to handle forwarding.
    // "onmessage" is a property of the StdioServerTransport class, so we need to
    // override it this way.
    this.onmessage = this.handleMessage.bind(this);
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
