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
  InitializeRequest,
  InitializeResult,
  ListToolsRequest,
  MethodsWithRequestType,
  MethodsWithResponseType,
  MethodsWithTransportErrorType,
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
  processTransportErrorThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../lib/config.js";
import { messageFromError } from "../lib/error.js";
import { handleTransportError } from "../lib/hooks/transport-error.js";
import type { ForwardResult, HttpErrorResponse } from "../lib/hooks/types.js";
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

/**
 * Configuration for generic request handling with hooks
 */
interface RequestHandlerConfig<TRequest, TResponse> {
  /**
   * Build a typed request from the JSON-RPC request
   */
  buildRequest: (
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ) => TRequest;

  /**
   * Method name for processing request through hooks (optional)
   */
  requestMethodName?: MethodsWithRequestType<TRequest>;

  /**
   * Method name for processing response through hooks (optional)
   */
  responseMethodName?: MethodsWithResponseType<TResponse, TRequest>;

  /**
   * Method name for processing transport error through hooks
   */
  transportErrorMethodName: MethodsWithTransportErrorType<TRequest>;

  /**
   * Error message prefix for catch block
   */
  errorPrefix: string;

  /**
   * Whether the handler supports direct responses from hooks
   */
  supportsDirectResponse?: boolean;
}

export class MessageHandler {
  private readonly hooks: Hook[];
  private readonly targetUrl: string;
  private readonly targetMcpPath: string;

  // Request handler configurations
  private readonly toolCallConfig: RequestHandlerConfig<
    CallToolRequest,
    CallToolResult
  > = {
    buildRequest: (request, headers) => {
      const params = request.params as { name: string; arguments?: unknown };
      return {
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
    },
    requestMethodName: "processToolCallRequest" as const,
    responseMethodName: "processToolCallResponse",
    transportErrorMethodName: "processToolCallTransportError",
    errorPrefix: "Error processing tool call",
    supportsDirectResponse: true,
  };

  private readonly toolsListConfig: RequestHandlerConfig<
    ListToolsRequest,
    ListToolsResult
  > = {
    buildRequest: (request, headers) => ({
      method: "tools/list",
      params: {
        _meta: {
          sessionId: headers["mcp-session-id"] || "unknown",
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      },
    }),
    requestMethodName: "processToolsListRequest",
    responseMethodName: "processToolsListResponse",
    transportErrorMethodName: "processToolsListTransportError",
    errorPrefix: "Error processing tools list",
    supportsDirectResponse: true,
  };

  private readonly initializeConfig: RequestHandlerConfig<
    InitializeRequest,
    InitializeResult
  > = {
    buildRequest: (request) => ({
      method: "initialize",
      params: request.params as InitializeRequest["params"],
    }),
    // No request/response hooks for initialize yet
    transportErrorMethodName: "processInitializeTransportError",
    errorPrefix: "Error processing initialize",
    supportsDirectResponse: false,
  };

  constructor(private config: Config) {
    this.hooks = getHookClients(config);
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";
  }

  /**
   * Check if hooks are configured
   */
  hasHooks(): boolean {
    return this.hooks.length > 0;
  }

  /**
   * Generic handler for requests with hook processing
   */
  private async handleRequestWithHooks<TRequest, TResponse>(
    request: JSONRPCRequest,
    headers: Record<string, string>,
    config: RequestHandlerConfig<TRequest, TResponse>,
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
    try {
      // Build the typed request
      const typedRequest = config.buildRequest(request, headers);
      let processedRequest = typedRequest;
      let lastProcessedIndex = -1;

      // Process through request hooks if configured
      if (config.requestMethodName) {
        const requestResult = await processRequestThroughHooks<
          TRequest,
          TResponse,
          typeof config.requestMethodName
        >(typedRequest, this.hooks, config.requestMethodName);
        lastProcessedIndex = requestResult.lastProcessedIndex;

        if (requestResult.resultType === "abort") {
          return createAbortResponse(
            "request",
            requestResult.reason,
            request.id,
            {},
          );
        }

        // Check for direct response if supported
        if (
          config.supportsDirectResponse &&
          requestResult.resultType === "respond"
        ) {
          return createSuccessResponse(
            requestResult.response as TResponse & Record<string, unknown>,
            request.id,
            {},
          );
        }

        if (requestResult.resultType === "continue") {
          processedRequest = requestResult.request as TRequest;
        }
      }

      // Forward the request
      const forwardResult = await this.forwardRequest(request, headers);

      // Handle transport errors
      if (forwardResult.type === "error") {
        return handleTransportError(
          forwardResult.error,
          request.id,
          forwardResult.headers,
          async () => {
            // Fix: When no request hooks were processed (lastProcessedIndex = -1),
            // start from the last hook to ensure all hooks are processed
            const startIndex =
              lastProcessedIndex >= 0
                ? lastProcessedIndex
                : this.hooks.length - 1;
            const result = await processTransportErrorThroughHooks<
              TRequest,
              typeof config.transportErrorMethodName
            >(
              forwardResult.error,
              processedRequest,
              this.hooks,
              startIndex,
              config.transportErrorMethodName,
            );
            if (result.resultType === "abort") {
              return {
                resultType: result.resultType,
                reason: result.reason,
              };
            }
            return {
              resultType: result.resultType,
              error: result.error,
            };
          },
        );
      }

      // Process response through hooks if configured
      if (config.responseMethodName) {
        const responseResult = await processResponseThroughHooks<
          TRequest,
          TResponse,
          typeof config.responseMethodName
        >(
          forwardResult.result as TResponse,
          processedRequest,
          this.hooks,
          lastProcessedIndex,
          config.responseMethodName,
        );

        if (responseResult.resultType === "abort") {
          return createAbortResponse(
            "response",
            responseResult.reason,
            request.id,
            forwardResult.headers,
          );
        }

        if (responseResult.resultType === "continue") {
          return createSuccessResponse(
            responseResult.response as TResponse & Record<string, unknown>,
            request.id,
            forwardResult.headers,
          );
        }
      }

      // Return the unmodified result
      return createSuccessResponse(
        forwardResult.result as TResponse & Record<string, unknown>,
        request.id,
        forwardResult.headers,
      );
    } catch (error) {
      const errorMsg = messageFromError(error);
      return createErrorResponse(
        -32603,
        `${config.errorPrefix}: ${errorMsg}`,
        errorMsg,
        request.id,
      );
    }
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

    const forwardResult = normalizeResponse(result.response, result.headers);
    // Add status code to the result
    forwardResult.statusCode = res.statusCode;
    return forwardResult;
  }

  /**
   * Handle a JSON-RPC message by forwarding it to the target and processing hooks
   */
  async handle(
    message: JSONRPCMessage,
    headers: Record<string, string> = {},
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
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
        return { message, headers: {}, statusCode: 200 };
      }

      const request = message as JSONRPCRequest;

      // Check if this request needs hook processing
      if (request.method === "tools/call") {
        return await this.handleToolCall(request, headers);
      }
      if (request.method === "tools/list") {
        return await this.handleToolsList(request, headers);
      }
      if (request.method === "initialize") {
        return await this.handleInitialize(request, headers);
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
        statusCode: result.statusCode || 200,
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
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
    return this.handleRequestWithHooks(request, headers, this.toolCallConfig);
  }

  /**
   * Handle tools/list requests with hook processing
   */
  private async handleToolsList(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
    return this.handleRequestWithHooks(request, headers, this.toolsListConfig);
  }

  /**
   * Handle initialize requests with hook processing
   */
  private async handleInitialize(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
    return this.handleRequestWithHooks(request, headers, this.initializeConfig);
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

        // Handle empty responses (e.g., from notifications)
        if (!responseBody || responseBody.trim() === "") {
          resolve({
            response: {
              jsonrpc: "2.0",
              result: {},
              id: requestId,
            } as JSONRPCResponse,
            headers: responseHeaders,
          });
          return;
        }

        // Try to parse as JSON-RPC response first
        try {
          const jsonResponse = JSON.parse(responseBody) as JSONRPCMessage;
          // Check if it's a valid JSON-RPC response or error
          if ("jsonrpc" in jsonResponse) {
            resolve({
              response: jsonResponse as JSONRPCResponse | JSONRPCError,
              headers: responseHeaders,
            });
            return;
          }
        } catch (error) {
          // Not valid JSON, fall through to HTTP error handling
        }

        // If we have an HTTP error status, create an HTTP transport error
        if (!res.statusCode || res.statusCode >= 400) {
          const httpError = {
            code: res.statusCode || 500,
            message: `HTTP ${res.statusCode}`,
            data: responseBody,
            responseType: "http" as const,
          };
          reject(httpError);
          return;
        }

        // If we get here, it's a 2xx response but not valid JSON-RPC
        reject(new Error(`Invalid JSON-RPC response: ${responseBody}`));
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
