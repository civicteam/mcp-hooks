/**
 * Message Handler Module
 *
 * Central message processing engine for the passthrough MCP server.
 *
 * Why this architecture:
 * 1. Transport agnostic - Both HTTP and stdio servers use the same handler
 * 2. Hook integration - Centralized place to apply hooks to all messages
 * 3. Protocol translation - Handles converting between different MCP transports
 * 4. Error normalization - Consistent error handling across transport types
 *
 * Why separate from transport servers:
 * - Allows testing message processing logic independently
 * - Makes it easy to add new transport types (WebSocket, gRPC, etc.)
 * - Keeps transport-specific concerns (HTTP headers, stdio streams) separate
 */

import type * as http from "node:http";
import { URL } from "node:url";
import type {
  CallToolRequestWithContext,
  CallToolResult,
  Hook,
  InitializeRequest,
  InitializeRequestWithContext,
  InitializeResult,
  ListToolsRequestWithContext,
  MethodsWithRequestType,
  MethodsWithResponseType,
  MethodsWithTransportErrorType,
  RequestContext,
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
import {
  type ForwardResult,
  type HttpErrorResponse,
  handleTransportError,
} from "../lib/hooks/index.js";
import { extractResponseHeaders } from "../lib/http/headers.js";
import {
  buildRequestOptions,
  makeHttpRequestAsync,
} from "../lib/http/request.js";
import {
  createAbortResponse,
  createErrorResponse,
  createErrorResponseFromTransportError,
  createSuccessResponse,
  httpErrorToForwardResult,
  isHttpError,
  normalizeResponse,
} from "../lib/jsonrpc/index.js";
import { logger } from "../lib/logger.js";
import { SSEParser } from "../lib/sse.js";

// All requests have a context, but are otherwise generic JSONRPC requests
type AbstractRequest = {
  requestContext?: RequestContext;
} & {
  method: string;
  params?: Record<string, unknown>;
};
/**
 * Configuration for generic request handling with hooks
 *
 * Why this pattern:
 * - DRY principle - All request types (tool call, tools list, initialize) follow
 *   the same processing flow, just with different types and hook methods
 * - Type safety - Each config specifies exact types and valid method names
 * - Extensibility - Easy to add new request types without duplicating logic
 *
 * Why optional hook methods:
 * - Not all request types support all hook phases
 * - Example: initialize might not have request/response hooks initially
 * - Allows gradual rollout of hook support for new message types
 */
interface RequestHandlerConfig<TRequest extends AbstractRequest, TResponse> {
  /**
   * Build a typed request from the JSON-RPC request
   *
   * Why: JSON-RPC requests are loosely typed, but hooks expect specific types.
   * This function transforms and enriches the raw request with metadata.
   */
  buildRequest: (
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ) => TRequest;

  /**
   * Method name for processing request through hooks (optional)
   *
   * Why constrained type: Ensures we can only specify methods that actually
   * accept TRequest as their parameter, preventing runtime errors.
   */
  requestMethodName?: MethodsWithRequestType<TRequest>;

  /**
   * Method name for processing response through hooks (optional)
   *
   * Why both TResponse and TRequest: Response hooks need the original request
   * for context, so the constraint ensures the method accepts both.
   */
  responseMethodName?: MethodsWithResponseType<TResponse, TRequest>;

  /**
   * Method name for processing transport error through hooks
   *
   * Why not optional: Every request type should handle transport errors,
   * even if no other hooks are implemented.
   */
  transportErrorMethodName: MethodsWithTransportErrorType<TRequest>;

  /**
   * Error message prefix for catch block
   *
   * Why: Provides context-specific error messages for different request types,
   * making debugging easier.
   */
  errorPrefix: string;

  /**
   * Whether the handler supports direct responses from hooks
   *
   * Why: Some hooks might want to return cached responses or synthetic data
   * without hitting the target server. Not all request types support this.
   */
  supportsDirectResponse?: boolean;
}

export class MessageHandler {
  private readonly hooks: Hook[];
  private readonly targetUrl: string;
  private readonly targetMcpPath: string;

  // Map of method names to their configurations
  private readonly methodConfigs: Record<
    string,
    RequestHandlerConfig<AbstractRequest, unknown>
  > = {};

  // Request handler configurations
  private readonly toolCallConfig: RequestHandlerConfig<
    CallToolRequestWithContext,
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
        requestContext: this.buildRequestContext(headers),
      };
    },
    requestMethodName: "processToolCallRequest" as const,
    responseMethodName: "processToolCallResponse",
    transportErrorMethodName: "processToolCallTransportError",
    errorPrefix: "Error processing tool call",
    supportsDirectResponse: true,
  };

  private readonly toolsListConfig: RequestHandlerConfig<
    ListToolsRequestWithContext,
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
      requestContext: this.buildRequestContext(headers),
    }),
    requestMethodName: "processToolsListRequest",
    responseMethodName: "processToolsListResponse",
    transportErrorMethodName: "processToolsListTransportError",
    errorPrefix: "Error processing tools list",
    supportsDirectResponse: true,
  };

  private readonly initializeConfig: RequestHandlerConfig<
    InitializeRequestWithContext,
    InitializeResult
  > = {
    buildRequest: (request, headers) => ({
      method: "initialize",
      params: request.params as InitializeRequest["params"],
      requestContext: this.buildRequestContext(headers),
    }),
    requestMethodName: "processInitializeRequest",
    responseMethodName: "processInitializeResponse",
    transportErrorMethodName: "processInitializeTransportError",
    errorPrefix: "Error processing initialize",
    supportsDirectResponse: false,
  };

  constructor(private config: Config) {
    this.hooks = getHookClients(config);
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";

    // Initialize method configurations
    this.methodConfigs["tools/call"] = this.toolCallConfig;
    this.methodConfigs["tools/list"] = this.toolsListConfig;
    this.methodConfigs.initialize = this.initializeConfig;
  }

  /**
   * Build request context from headers and target URL
   */
  private buildRequestContext(headers: Record<string, string>): RequestContext {
    const fullTargetUrl = this.targetUrl + this.targetMcpPath;
    const targetUrl = new URL(fullTargetUrl);

    return {
      headers,
      host: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
    };
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
  private async handleRequestWithHooks<
    TRequest extends AbstractRequest,
    TResponse,
  >(
    request: JSONRPCRequest,
    headers: Record<string, string>,
    config: RequestHandlerConfig<TRequest, TResponse>,
  ): Promise<{
    message: JSONRPCMessage | HttpErrorResponse;
    headers: Record<string, string>;
    statusCode?: number;
  }> {
    let processedResponse: (TResponse & Record<string, unknown>) | undefined;
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
          // Don't return, but just skip the forwardRequest
          processedResponse = requestResult.response as TResponse &
            Record<string, unknown>;
        }

        if (requestResult.resultType === "continue") {
          processedRequest = requestResult.request;
        }
      } else {
        logger.warn(
          `[MessageHandler] No request hooks configured for method ${request.method}`,
        );
      }

      // forward headers are needed for response processing
      let forwardHeaders: Record<string, string> = {};
      // only forward request if no direct response was returned.
      if (!processedResponse) {
        // Extract request context from processed request
        const processedContext = processedRequest.requestContext;

        // Forward the request with potentially modified context
        const forwardResult = await this.forwardRequest(
          request,
          headers,
          processedContext,
        );

        forwardHeaders = forwardResult.headers;

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
              return processTransportErrorThroughHooks<
                TRequest,
                typeof config.transportErrorMethodName
              >(
                forwardResult.error,
                processedRequest,
                this.hooks,
                startIndex,
                config.transportErrorMethodName,
              );
            },
          );
        }

        processedResponse = forwardResult.result as TResponse &
          Record<string, unknown>;
      }

      // Process response through hooks if configured
      if (config.responseMethodName) {
        const responseResult = await processResponseThroughHooks<
          TRequest,
          TResponse,
          typeof config.responseMethodName
        >(
          processedResponse,
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
            forwardHeaders,
          );
        }

        if (responseResult.resultType === "continue") {
          return createSuccessResponse(
            responseResult.response as TResponse & Record<string, unknown>,
            request.id,
            forwardHeaders,
          );
        }
      }

      // Return the unmodified result
      return createSuccessResponse(
        processedResponse as TResponse & Record<string, unknown>,
        request.id,
        forwardHeaders,
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

      // Check if we have a configuration for this method
      const methodConfig = this.methodConfigs[request.method];
      if (methodConfig) {
        return await this.handleRequestWithHooks(
          request,
          headers,
          methodConfig,
        );
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
    reqContext?: RequestContext,
  ): Promise<ForwardResult> {
    // Start with default target URL
    let fullTargetUrl = this.targetUrl + this.targetMcpPath;

    // Override host and path if provided in req context
    if (reqContext) {
      if (reqContext.host || reqContext.path) {
        const baseUrl = new URL(this.targetUrl);
        const targetUrl = new URL(fullTargetUrl);

        if (reqContext.host) {
          targetUrl.hostname = reqContext.host;
        }

        if (reqContext.path) {
          targetUrl.pathname = reqContext.path;
          targetUrl.search = ""; // Clear search params if path is overridden
        }

        // Keep the protocol from the original URL
        targetUrl.protocol = baseUrl.protocol;

        fullTargetUrl = targetUrl.toString();
      }
    }

    const targetUrl = new URL(fullTargetUrl);
    const requestBody = JSON.stringify(request);

    // Merge headers from req context if provided
    const finalHeaders = reqContext?.headers
      ? { ...headers, ...reqContext.headers }
      : headers;

    logger.info(
      `[MessageHandler] Forwarding to ${fullTargetUrl}: ${requestBody}`,
    );
    logger.info(
      `[MessageHandler] Forward headers: ${JSON.stringify(finalHeaders)}`,
    );

    try {
      const options = buildRequestOptions(targetUrl, requestBody, finalHeaders);
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
