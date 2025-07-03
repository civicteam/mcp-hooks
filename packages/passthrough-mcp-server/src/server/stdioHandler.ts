/**
 * Stdio Handler Module
 *
 * Provides stdio transport handling using the MessageHandler
 * for transparent message forwarding to HTTP targets.
 */

import type { IncomingMessage } from "node:http";
import { URL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import { makeHttpRequest } from "../utils/http.js";
import { logger } from "../utils/logger.js";
import { SSEParser } from "../utils/sse.js";
import { MessageHandler } from "./messageHandler.js";

/**
 * Establish SSE connection to receive server-initiated messages
 */
async function establishSSEConnection(
  config: Config,
  sessionId: string,
  authHeaders: Record<string, string>,
  transport: StdioServerTransport,
): Promise<void> {
  const targetUrl = config.target.url;
  const mcpPath = config.target.mcpPath || "/mcp";
  const fullUrl = targetUrl + mcpPath;

  logger.info(`[StdioHandler] Establishing SSE connection to ${fullUrl}`);

  try {
    const urlObj = new URL(fullUrl);

    const headers = {
      ...authHeaders,
      "mcp-session-id": sessionId,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers,
    };

    const req = makeHttpRequest(options, urlObj);

    req.on("response", (res: IncomingMessage) => {
      logger.info(
        `[StdioHandler] SSE connection established, status: ${res.statusCode}`,
      );

      if (res.statusCode !== 200) {
        logger.error(
          `[StdioHandler] SSE connection failed with status ${res.statusCode}`,
        );
        return;
      }

      const sseParser = new SSEParser();

      res.on("data", (chunk: Buffer) => {
        const events = sseParser.processChunk(chunk.toString());

        for (const event of events) {
          if (event.event === "message" && event.data) {
            try {
              const message = JSON.parse(event.data) as JSONRPCMessage;
              logger.info(
                `[StdioHandler] Received SSE message: ${JSON.stringify(message)}`,
              );

              // Forward the message to the stdio client
              transport.send(message).catch((error) => {
                logger.error(
                  `[StdioHandler] Failed to forward SSE message: ${error}`,
                );
              });
            } catch (error) {
              logger.error(`[StdioHandler] Failed to parse SSE data: ${error}`);
            }
          }
        }
      });

      res.on("end", () => {
        logger.info("[StdioHandler] SSE connection closed");
      });

      res.on("error", (error) => {
        logger.error(`[StdioHandler] SSE connection error: ${error}`);
      });
    });

    req.on("error", (error) => {
      logger.error(
        `[StdioHandler] Failed to establish SSE connection: ${error}`,
      );
    });

    req.end();
  } catch (error) {
    logger.error(`[StdioHandler] Error setting up SSE connection: ${error}`);
  }
}

/**
 * Create and configure stdio transport with protocol forwarder
 */
export async function createStdioServer(config: Config): Promise<{
  transport: StdioServerTransport;
  messageHandler: MessageHandler;
}> {
  // Create the transport
  const transport = new StdioServerTransport();

  // Create message handler
  const messageHandler = new MessageHandler(config);

  // Extract auth headers from config if provided
  const authHeaders: Record<string, string> = {};
  if (config.authToken) {
    authHeaders.authorization = `Bearer ${config.authToken}`;
  }

  // Store session ID from initialize response
  let sessionId: string | undefined;

  // Set up message forwarding
  transport.onmessage = async (message: JSONRPCMessage) => {
    logger.info(`[StdioHandler] Received message: ${JSON.stringify(message)}`);

    // Include session ID in headers if we have one
    const headers = { ...authHeaders };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const result = await messageHandler.handle(message, headers);

    // Extract session ID from initialize response
    if (
      "method" in message &&
      message.method === "initialize" &&
      result.headers?.["mcp-session-id"]
    ) {
      sessionId = result.headers["mcp-session-id"];
      logger.info(`[StdioHandler] Stored session ID: ${sessionId}`);

      // Establish SSE connection for receiving server-initiated messages
      establishSSEConnection(config, sessionId, authHeaders, transport).catch(
        (error) => {
          logger.error(
            `[StdioHandler] Failed to establish SSE connection: ${error}`,
          );
        },
      );
    }

    logger.info(
      `[StdioHandler] Sending response: ${JSON.stringify(result.message)}`,
    );
    // Note: stdio transport doesn't support custom headers, only the message
    if (result.message) {
      await transport.send(result.message);
    }
  };

  // Log transport errors
  transport.onerror = (error: Error) => {
    logger.error(`Stdio transport error: ${error.message}`);
  };

  // Handle transport close
  transport.onclose = () => {
    logger.info("Stdio transport closed");
  };

  return { transport, messageHandler };
}
