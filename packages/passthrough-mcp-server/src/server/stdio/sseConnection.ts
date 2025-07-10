/**
 * SSE Connection Module
 *
 * Handles Server-Sent Events connections for receiving server-initiated messages
 * from remote MCP servers.
 */

import type { IncomingMessage } from "node:http";
import { URL } from "node:url";
import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../utils/config.js";
import { makeHttpRequest } from "../../utils/http.js";
import { logger } from "../../utils/logger.js";
import { SSEParser } from "../../utils/sse.js";

/**
 * Establish SSE connection to receive server-initiated messages
 */
export async function establishSSEConnection(
  config: Config,
  sessionId: string,
  authHeaders: Record<string, string>,
  transport: StdioServerTransport,
): Promise<void> {
  const targetUrl = config.target.url;
  const mcpPath = config.target.mcpPath || "/mcp";
  const fullUrl = targetUrl + mcpPath;

  logger.info(`[SSEConnection] Establishing SSE connection to ${fullUrl}`);

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
        `[SSEConnection] SSE connection established, status: ${res.statusCode}`,
      );

      if (res.statusCode !== 200) {
        logger.error(
          `[SSEConnection] SSE connection failed with status ${res.statusCode}`,
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
                `[SSEConnection] Received SSE message: ${JSON.stringify(message)}`,
              );

              // Forward the message to the stdio client
              transport.send(message).catch((error) => {
                logger.error(
                  `[SSEConnection] Failed to forward SSE message: ${error}`,
                );
              });
            } catch (error) {
              logger.error(
                `[SSEConnection] Failed to parse SSE data: ${error}`,
              );
            }
          }
        }
      });

      res.on("end", () => {
        logger.info("[SSEConnection] SSE connection closed");
      });

      res.on("error", (error) => {
        logger.error(`[SSEConnection] SSE connection error: ${error}`);
      });
    });

    req.on("error", (error) => {
      logger.error(
        `[SSEConnection] Failed to establish SSE connection: ${error}`,
      );
    });

    req.end();
  } catch (error) {
    logger.error(`[SSEConnection] Error setting up SSE connection: ${error}`);
  }
}
