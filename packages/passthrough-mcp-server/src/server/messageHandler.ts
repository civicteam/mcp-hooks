/**
 * Message Handler Module
 *
 * Provides shared message processing logic for both HTTP and stdio transports.
 * Handles JSON-RPC message forwarding to HTTP targets with hook processing.
 */

import type * as http from "node:http";
import { URL } from "node:url";
import type {
  CallToolRequest,
  CallToolResult,
  Hook,
  ListToolsRequest,
} from "@civic/hook-common";
import type {
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../utils/config.js";
import { messageFromError } from "../utils/error.js";
import { extractResponseHeaders, makeHttpRequest } from "../utils/http.js";
import { logger } from "../utils/logger.js";
import { SSEParser } from "../utils/sse.js";

export class MessageHandler {
  private hooks: Hook[];
  private targetUrl: string;
  private targetMcpPath: string;

  constructor(private config: Config) {
    this.hooks = getHookClients(config);
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";
  }

  /**
   * Handle a JSON-RPC message by forwarding it to the target and processing hooks
   */
  async handle(
    message: JSONRPCMessage,
    headers: Record<string, string> = {},
  ): Promise<{ message: JSONRPCMessage; headers: Record<string, string> }> {
    logger.info(
      `[MessageHandler] Processing message: ${JSON.stringify(message)}`,
    );
    logger.info(`[MessageHandler] Headers: ${JSON.stringify(headers)}`);

    try {
      // Only process requests
      if (!("method" in message)) {
        logger.warn(
          `[MessageHandler] Received non-request message: ${JSON.stringify(message)}`,
        );
        return { message, headers: {} };
      }

      const request = message as JSONRPCRequest;

      // Check if this request needs hook processing
      if (request.method === "tools/call") {
        return await this.handleToolCall(request, headers);
      }
      if (request.method === "tools/list") {
        return await this.handleToolsList(request, headers);
      }

      // Forward all other requests directly
      const result = await this.forwardRequest(request, headers);
      return { message: result.response, headers: result.headers };
    } catch (error) {
      const errorMessage = messageFromError(error);
      logger.error(
        `[MessageHandler] Error processing message: ${errorMessage}`,
      );

      return {
        message: {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: errorMessage,
          },
          id: "id" in message ? message.id : null,
        } as JSONRPCError,
        headers: {},
      };
    }
  }

  /**
   * Handle tools/call requests with hook processing
   */
  private async handleToolCall(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<{ message: JSONRPCMessage; headers: Record<string, string> }> {
    try {
      // Extract tool call information
      const params = request.params as { name: string; arguments?: unknown };
      const toolCall: CallToolRequest = {
        method: "tools/call",
        params: {
          name: params.name,
          arguments: params.arguments || {},
          _meta: {
            sessionId: headers["mcp-session-id"] || "unknown",
            timestamp: new Date().toISOString(),
            source: "passthrough-server",
          },
        },
      };

      // Process through request hooks
      const requestResult = await processRequestThroughHooks(
        toolCall,
        this.hooks,
      );

      if (requestResult.resultType === "abort") {
        return {
          message: {
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: requestResult.reason || "Request rejected by hook",
              data: null,
            },
            id: request.id,
          } as JSONRPCError,
          headers: {},
        };
      }

      // Check if a hook provided a direct response
      if (requestResult.resultType === "respond") {
        return {
          message: {
            jsonrpc: "2.0",
            id: request.id,
            result: requestResult.response,
          } as JSONRPCResponse,
          headers: {},
        };
      }

      // Forward to target
      const forwardResult = await this.forwardRequest(request, headers);
      const response = forwardResult.response;
      const responseHeaders = forwardResult.headers;

      // Process response through hooks if successful
      if ("result" in response) {
        const responseResult = await processResponseThroughHooks(
          response.result as CallToolResult,
          requestResult.request,
          this.hooks,
          requestResult.lastProcessedIndex,
        );

        if (responseResult.resultType === "abort") {
          return {
            message: {
              jsonrpc: "2.0",
              error: {
                code: -32002,
                message: responseResult.reason || "Response rejected by hook",
                data: null,
              },
              id: request.id,
            } as JSONRPCError,
            headers: responseHeaders,
          };
        }

        // Return modified response
        return {
          message: {
            ...response,
            result:
              responseResult.resultType === "continue"
                ? responseResult.response
                : response.result,
          },
          headers: responseHeaders,
        };
      }

      return { message: response, headers: responseHeaders };
    } catch (error) {
      return {
        message: {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Error processing tool call: ${messageFromError(error)}`,
            data: messageFromError(error),
          },
          id: request.id,
        } as JSONRPCError,
        headers: {},
      };
    }
  }

  /**
   * Handle tools/list requests with hook processing
   */
  private async handleToolsList(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<{ message: JSONRPCMessage; headers: Record<string, string> }> {
    try {
      // Create tools list request
      const toolsListRequest: ListToolsRequest = {
        method: "tools/list",
        params: {
          _meta: {
            sessionId: headers["mcp-session-id"] || "unknown",
            timestamp: new Date().toISOString(),
            source: "passthrough-server",
          },
        },
      };

      // Process through request hooks
      const requestResult = await processToolsListRequestThroughHooks(
        toolsListRequest,
        this.hooks,
      );

      if (requestResult.resultType === "abort") {
        return {
          message: {
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: requestResult.reason || "Request rejected by hook",
              data: null,
            },
            id: request.id,
          } as JSONRPCError,
          headers: {},
        };
      }

      // Forward to target
      const forwardResult = await this.forwardRequest(request, headers);
      const response = forwardResult.response;
      const responseHeaders = forwardResult.headers;

      // Process response through hooks if successful
      if ("result" in response) {
        const responseResult = await processToolsListResponseThroughHooks(
          response.result as ListToolsResult,
          requestResult.resultType === "continue"
            ? requestResult.request
            : toolsListRequest,
          this.hooks,
          requestResult.lastProcessedIndex,
        );

        if (responseResult.resultType === "abort") {
          return {
            message: {
              jsonrpc: "2.0",
              error: {
                code: -32002,
                message: responseResult.reason || "Response rejected by hook",
                data: null,
              },
              id: request.id,
            } as JSONRPCError,
            headers: responseHeaders,
          };
        }

        // Return modified response
        return {
          message: {
            ...response,
            result:
              responseResult.resultType === "continue"
                ? responseResult.response
                : response.result,
          },
          headers: responseHeaders,
        };
      }

      return { message: response, headers: responseHeaders };
    } catch (error) {
      return {
        message: {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Error processing tools list: ${messageFromError(error)}`,
            data: messageFromError(error),
          },
          id: request.id,
        } as JSONRPCError,
        headers: {},
      };
    }
  }

  /**
   * Handle SSE response by parsing events and extracting JSON data
   */
  private async handleSSEResponse(
    res: http.IncomingMessage,
    responseHeaders: Record<string, string>,
  ): Promise<{
    response: JSONRPCResponse | JSONRPCError;
    headers: Record<string, string>;
  }> {
    return new Promise((resolve, reject) => {
      let responseBody = "";
      const sseParser = new SSEParser();

      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        logger.info(`[MessageHandler] SSE Response body: ${responseBody}`);

        // Parse SSE events
        const events = sseParser.processChunk(responseBody);
        const lastEvent = sseParser.flush();
        if (lastEvent) events.push(lastEvent);

        // Find the first event with JSON data
        for (const event of events) {
          if (event.data) {
            try {
              const jsonResponse = JSON.parse(event.data) as JSONRPCMessage;
              resolve({
                response: jsonResponse as JSONRPCResponse | JSONRPCError,
                headers: responseHeaders,
              });
              return;
            } catch (e) {
              // Not JSON, continue
            }
          }
        }

        reject(new Error("No valid JSON data found in SSE response"));
      });

      res.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Handle JSON response by parsing and validating
   */
  private async handleJSONResponse(
    res: http.IncomingMessage,
    responseHeaders: Record<string, string>,
    requestId: string | number,
  ): Promise<{
    response: JSONRPCResponse | JSONRPCError;
    headers: Record<string, string>;
  }> {
    return new Promise((resolve, reject) => {
      let responseBody = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        logger.info(`[MessageHandler] Response body: ${responseBody}`);

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
          return;
        }

        // Handle empty responses (e.g., from notifications)
        if (!responseBody || responseBody.trim() === "") {
          resolve({
            response: {
              jsonrpc: "2.0",
              result: null,
              id: requestId,
            } as unknown as JSONRPCResponse,
            headers: responseHeaders,
          });
          return;
        }

        try {
          const jsonResponse = JSON.parse(responseBody) as JSONRPCMessage;
          resolve({
            response: jsonResponse as JSONRPCResponse | JSONRPCError,
            headers: responseHeaders,
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error}`));
        }
      });

      res.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Forward a request to the target server via HTTP
   */
  private async forwardRequest(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<{
    response: JSONRPCResponse | JSONRPCError;
    headers: Record<string, string>;
  }> {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    logger.info(
      `[MessageHandler] Forwarding to ${fullTargetUrl}: ${JSON.stringify(request)}`,
    );
    logger.info(`[MessageHandler] Forward headers: ${JSON.stringify(headers)}`);

    return new Promise<{
      response: JSONRPCResponse | JSONRPCError;
      headers: Record<string, string>;
    }>((resolve, reject) => {
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

        req.on("response", async (res) => {
          logger.info(`[MessageHandler] Response status: ${res.statusCode}`);

          // Extract response headers
          const responseHeaders = extractResponseHeaders(res.headers);
          logger.info(
            `[MessageHandler] Response headers: ${JSON.stringify(responseHeaders)}`,
          );

          // Check if this is an SSE response
          const contentType = res.headers["content-type"] || "";
          const isSSE = contentType.includes("text/event-stream");

          try {
            if (isSSE) {
              const result = await this.handleSSEResponse(res, responseHeaders);
              resolve(result);
            } else {
              const result = await this.handleJSONResponse(
                res,
                responseHeaders,
                request.id,
              );
              resolve(result);
            }
          } catch (error) {
            reject(error);
          }
        });

        req.on("error", (error) => {
          logger.error(`[MessageHandler] Request error: ${error}`);
          reject(error);
        });

        // Write request body
        req.write(requestBody);
        req.end();
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      logger.error(
        `[MessageHandler] Forward error: ${messageFromError(error)}`,
      );
      return {
        response: {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Failed to forward request: ${messageFromError(error)}`,
            data: messageFromError(error),
          },
          id: request.id,
        } as JSONRPCError,
        headers: {},
      };
    });
  }
}
