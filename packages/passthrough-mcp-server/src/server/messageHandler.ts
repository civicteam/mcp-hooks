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
  processToolCallTransportErrorThroughHooks,
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
  processToolsListTransportErrorThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../lib/config.js";
import { messageFromError } from "../lib/error.js";
import { handleTransportError } from "../lib/hooks/transport-error.js";
import type { ForwardResult } from "../lib/hooks/types.js";
import { extractResponseHeaders } from "../lib/http/headers.js";
import {
  buildRequestOptions,
  makeHttpRequestAsync,
} from "../lib/http/request.js";
import {
  createErrorResponse,
  createErrorResponseFromTransportError,
  httpErrorToForwardResult,
  isHttpError,
} from "../lib/jsonrpc/errors.js";
import { normalizeResponse } from "../lib/jsonrpc/normalize.js";
import {
  createAbortResponse,
  createSuccessResponse,
} from "../lib/jsonrpc/responses.js";
import { logger } from "../lib/logger.js";
import { SSEParser } from "../lib/sse.js";

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
   * Handle HTTP response and convert to ForwardResult
   */
  private async handleResponse(
    res: http.IncomingMessage,
    requestId: string | number,
  ): Promise<ForwardResult> {
    logger.info(`[MessageHandler] Response status: ${res.statusCode}`);

    const responseHeaders = extractResponseHeaders(res.headers);
    logger.info(
      `[MessageHandler] Response headers: ${JSON.stringify(responseHeaders)}`,
    );

    const contentType = res.headers["content-type"] || "";
    const isSSE = contentType.includes("text/event-stream");

    const result = isSSE
      ? await this.handleSSEResponse(res, responseHeaders)
      : await this.handleJSONResponse(res, responseHeaders, requestId);

    return normalizeResponse(result.response, result.headers);
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

      // Handle the result based on type
      if (result.type === "error") {
        return createErrorResponseFromTransportError(
          result.error,
          request.id,
          result.headers,
        );
      }

      return {
        message: {
          jsonrpc: "2.0",
          id: request.id,
          result: result.result,
        } as JSONRPCResponse,
        headers: result.headers,
      };
    } catch (error) {
      const errorMessage = messageFromError(error);
      logger.error(
        `[MessageHandler] Error processing message: ${errorMessage}`,
      );

      return createErrorResponse(
        -32603,
        "Internal error",
        errorMessage,
        "id" in message ? message.id : null,
      );
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
        return createAbortResponse(
          "request",
          requestResult.reason,
          request.id,
          {},
        );
      }

      // Check if a hook provided a direct response
      if (requestResult.resultType === "respond") {
        return createSuccessResponse(requestResult.response, request.id, {});
      }

      // Forward to target
      const forwardResult = await this.forwardRequest(request, headers);

      if (forwardResult.type === "error") {
        return handleTransportError(
          forwardResult.error,
          request.id,
          forwardResult.headers,
          () =>
            processToolCallTransportErrorThroughHooks(
              forwardResult.error,
              requestResult.request,
              this.hooks,
              requestResult.lastProcessedIndex,
            ),
        );
      }

      // Process successful response through hooks
      const responseResult = await processResponseThroughHooks(
        forwardResult.result as CallToolResult,
        requestResult.request,
        this.hooks,
        requestResult.lastProcessedIndex,
      );

      if (responseResult.resultType === "abort") {
        return createAbortResponse(
          "response",
          responseResult.reason,
          request.id,
          forwardResult.headers,
        );
      }

      // Return modified response
      return createSuccessResponse(
        responseResult.resultType === "continue"
          ? responseResult.response
          : forwardResult.result,
        request.id,
        forwardResult.headers,
      );
    } catch (error) {
      const errorMsg = messageFromError(error);
      return createErrorResponse(
        -32603,
        `Error processing tool call: ${errorMsg}`,
        errorMsg,
        request.id,
      );
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
        return createAbortResponse(
          "request",
          requestResult.reason,
          request.id,
          {},
        );
      }

      // Forward to target
      const forwardResult = await this.forwardRequest(request, headers);

      if (forwardResult.type === "error") {
        return handleTransportError(
          forwardResult.error,
          request.id,
          forwardResult.headers,
          () =>
            processToolsListTransportErrorThroughHooks(
              forwardResult.error,
              requestResult.resultType === "continue"
                ? requestResult.request
                : toolsListRequest,
              this.hooks,
              requestResult.lastProcessedIndex,
            ),
        );
      }

      // Process successful response through hooks
      const responseResult = await processToolsListResponseThroughHooks(
        forwardResult.result as ListToolsResult,
        requestResult.resultType === "continue"
          ? requestResult.request
          : toolsListRequest,
        this.hooks,
        requestResult.lastProcessedIndex,
      );

      if (responseResult.resultType === "abort") {
        return createAbortResponse(
          "response",
          responseResult.reason,
          request.id,
          forwardResult.headers,
        );
      }

      // Return modified response
      return createSuccessResponse(
        responseResult.resultType === "continue"
          ? responseResult.response
          : forwardResult.result,
        request.id,
        forwardResult.headers,
      );
    } catch (error) {
      const errorMsg = messageFromError(error);
      return createErrorResponse(
        -32603,
        `Error processing tools list: ${errorMsg}`,
        errorMsg,
        request.id,
      );
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
          const httpError = {
            code: res.statusCode || 500,
            message: `HTTP ${res.statusCode}`,
            data: responseBody,
          };
          reject(httpError);
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
  ): Promise<ForwardResult> {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    const targetUrl = new URL(fullTargetUrl);
    const requestBody = JSON.stringify(request);

    logger.info(
      `[MessageHandler] Forwarding to ${fullTargetUrl}: ${requestBody}`,
    );
    logger.info(`[MessageHandler] Forward headers: ${JSON.stringify(headers)}`);

    try {
      const options = buildRequestOptions(targetUrl, requestBody, headers);
      const response = await makeHttpRequestAsync(
        options,
        targetUrl,
        requestBody,
      );
      return await this.handleResponse(response, request.id);
    } catch (error) {
      if (isHttpError(error)) {
        return httpErrorToForwardResult(error);
      }
      throw error;
    }
  }
}
