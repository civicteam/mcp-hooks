/**
 * Streaming Message Handler Module
 *
 * Provides streaming support for SSE responses while maintaining
 * compatibility with regular JSON responses.
 */

import type * as http from "node:http";
import { Readable } from "node:stream";
import { URL } from "node:url";
import type {
  JSONRPCError,
  JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../utils/config.js";
import { messageFromError } from "../../utils/error.js";
import { extractResponseHeaders, makeHttpRequest } from "../../utils/http.js";
import { logger } from "../../utils/logger.js";

export interface StreamingResult {
  stream: Readable;
  headers: Record<string, string>;
  isSSE: boolean;
  statusCode: number;
}

export class StreamingMessageHandler {
  private targetUrl: string;
  private targetMcpPath: string;

  constructor(private config: Config) {
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";
  }

  /**
   * Forward a request to the target server and return a stream
   */
  async forwardRequestStreaming(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<StreamingResult> {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    logger.info(
      `[StreamingMessageHandler] Forwarding to ${fullTargetUrl}: ${JSON.stringify(request)}`,
    );
    logger.info(
      `[StreamingMessageHandler] Forward headers: ${JSON.stringify(headers)}`,
    );

    return new Promise<StreamingResult>((resolve, reject) => {
      try {
        const targetUrlObj = new URL(fullTargetUrl);
        const requestBody = JSON.stringify(request);

        const options: http.RequestOptions = {
          hostname: targetUrlObj.hostname,
          port: targetUrlObj.port,
          path: targetUrlObj.pathname + targetUrlObj.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            ...headers,
            "Content-Length": Buffer.byteLength(requestBody),
          },
        };

        const req = makeHttpRequest(options, targetUrlObj);

        req.on("response", (res) => {
          logger.info(
            `[StreamingMessageHandler] Response status: ${res.statusCode}`,
          );

          // Check for error status codes
          if (!res.statusCode || res.statusCode >= 400) {
            // Collect error body
            let errorBody = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              errorBody += chunk;
            });
            res.on("end", () => {
              reject(new Error(`HTTP ${res.statusCode}: ${errorBody}`));
            });
            return;
          }

          // Extract response headers
          const responseHeaders = extractResponseHeaders(res.headers);
          logger.info(
            `[StreamingMessageHandler] Response headers: ${JSON.stringify(responseHeaders)}`,
          );

          // Check if this is an SSE response
          const contentType = res.headers["content-type"] || "";
          const isSSE = contentType.includes("text/event-stream");

          // Return the response stream directly
          resolve({
            stream: res,
            headers: responseHeaders,
            isSSE,
            statusCode: res.statusCode || 200,
          });
        });

        req.on("error", (error) => {
          logger.error(`[StreamingMessageHandler] Request error: ${error}`);
          reject(error);
        });

        // Write request body
        req.write(requestBody);
        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Forward a GET request to the target server
   */
  async forwardGetRequest(
    req: http.IncomingMessage,
    headers: Record<string, string>,
    res: http.ServerResponse,
  ): Promise<void> {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    logger.info(`[StreamingMessageHandler] Forwarding GET to ${fullTargetUrl}`);
    logger.info(
      `[StreamingMessageHandler] Forward headers: ${JSON.stringify(headers)}`,
    );

    try {
      const targetUrlObj = new URL(fullTargetUrl);

      const options: http.RequestOptions = {
        hostname: targetUrlObj.hostname,
        port: targetUrlObj.port,
        path: targetUrlObj.pathname + targetUrlObj.search,
        method: "GET",
        headers: {
          ...headers,
        },
      };

      const httpReq = makeHttpRequest(options, targetUrlObj);

      httpReq.on("response", (targetRes) => {
        logger.info(
          `[StreamingMessageHandler] GET Response status: ${targetRes.statusCode}`,
        );

        // Extract response headers
        const responseHeaders = extractResponseHeaders(targetRes.headers);
        logger.info(
          `[StreamingMessageHandler] GET Response headers: ${JSON.stringify(responseHeaders)}`,
        );

        // Forward status and headers - preserve exact status code
        res.writeHead(targetRes.statusCode || 200, responseHeaders);

        // Pipe the response directly
        targetRes.pipe(res);
      });

      httpReq.on("error", (error) => {
        logger.error(`[StreamingMessageHandler] GET Request error: ${error}`);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end("Bad Gateway");
        }
      });

      // End request (no body for GET)
      httpReq.end();
    } catch (error) {
      logger.error(
        `[StreamingMessageHandler] GET Forward error: ${messageFromError(error)}`,
      );
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  }

  /**
   * Forward a HEAD request to the target server
   */
  async forwardHeadRequest(
    req: http.IncomingMessage,
    headers: Record<string, string>,
    res: http.ServerResponse,
  ): Promise<void> {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    logger.info(
      `[StreamingMessageHandler] Forwarding HEAD to ${fullTargetUrl}`,
    );
    logger.info(
      `[StreamingMessageHandler] Forward headers: ${JSON.stringify(headers)}`,
    );

    try {
      const targetUrlObj = new URL(fullTargetUrl);

      const options: http.RequestOptions = {
        hostname: targetUrlObj.hostname,
        port: targetUrlObj.port,
        path: targetUrlObj.pathname + targetUrlObj.search,
        method: "HEAD",
        headers: {
          ...headers,
        },
      };

      const httpReq = makeHttpRequest(options, targetUrlObj);

      httpReq.on("response", (targetRes) => {
        logger.info(
          `[StreamingMessageHandler] HEAD Response status: ${targetRes.statusCode}`,
        );

        // Extract response headers
        const responseHeaders = extractResponseHeaders(targetRes.headers);
        logger.info(
          `[StreamingMessageHandler] HEAD Response headers: ${JSON.stringify(responseHeaders)}`,
        );

        // Forward status and headers - preserve exact status code
        res.writeHead(targetRes.statusCode || 200, responseHeaders);

        // HEAD responses should not have a body
        res.end();
      });

      httpReq.on("error", (error) => {
        logger.error(`[StreamingMessageHandler] HEAD Request error: ${error}`);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end("Bad Gateway");
        }
      });

      // End request (no body for HEAD)
      httpReq.end();
    } catch (error) {
      logger.error(
        `[StreamingMessageHandler] HEAD Forward error: ${messageFromError(error)}`,
      );
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  }

  /**
   * Create an error response stream
   */
  createErrorStream(error: Error, requestId: string | number): Readable {
    const errorResponse: JSONRPCError = {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: `Failed to forward request: ${messageFromError(error)}`,
        data: messageFromError(error),
      },
      id: requestId,
    };

    const stream = new Readable({
      read() {
        this.push(JSON.stringify(errorResponse));
        this.push(null);
      },
    });

    return stream;
  }
}
