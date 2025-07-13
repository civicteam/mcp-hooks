/**
 * MCP Protocol Handler Module
 *
 * Implements stateless HTTP proxying for MCP protocol messages.
 * Transparently passes all MCP requests to the target server with auth headers.
 * Supports both regular JSON responses and streaming SSE responses.
 */

import type http from "node:http";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../../lib/config.js";
import { messageFromError } from "../../lib/error.js";
import { logger } from "../../lib/logger.js";
import {
  formatSSEEvent,
  isSSERequest,
  parseSSERequest,
} from "../../lib/sse.js";
import { MessageHandler } from "../messageHandler.js";
import { StreamingMessageHandler } from "./streamingMessageHandler.js";

export interface MCPHandlerOptions {
  config: Config;
  sessionIdGenerator?: () => string;
}

/**
 * Validate HTTP method and return early if not POST, GET, or HEAD
 */
function validateHttpMethod(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  if (req.method !== "POST" && req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return false;
  }
  return true;
}

/**
 * Buffer and read the request body
 */
async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const requestBody = Buffer.concat(chunks);
  return requestBody.toString();
}

/**
 * Parse JSON-RPC message from request body
 * Handles both JSON and SSE formats
 */
function parseJsonRpcMessage(
  body: string,
  contentType?: string,
): JSONRPCMessage | null {
  try {
    // Check if this is an SSE request
    if (isSSERequest(contentType)) {
      const jsonData = parseSSERequest(body);
      if (!jsonData) {
        return null;
      }
      return JSON.parse(jsonData) as JSONRPCMessage;
    }

    // Regular JSON parsing
    return JSON.parse(body) as JSONRPCMessage;
  } catch (error) {
    return null;
  }
}

/**
 * Send JSON-RPC parse error response
 */
function sendParseError(res: http.ServerResponse): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Parse error",
      },
      id: null,
    }),
  );
}

/**
 * Extract headers to forward, excluding connection-specific ones
 */
function extractForwardHeaders(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  const forwardHeaders: Record<string, string> = {};
  const excludeHeaders = [
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
  ];

  for (const [header, value] of Object.entries(headers)) {
    if (
      !excludeHeaders.includes(header.toLowerCase()) &&
      typeof value === "string"
    ) {
      forwardHeaders[header] = value;
    }
  }

  return forwardHeaders;
}

/**
 * Check if request needs hook processing
 */
function needsHookProcessing(message: JSONRPCMessage): boolean {
  // All requests should go through hook processing
  return "method" in message;
}

/**
 * Check if client expects SSE response
 */
function clientExpectsSSE(headers: http.IncomingHttpHeaders): boolean {
  const accept = headers.accept || "";
  return accept.includes("text/event-stream");
}

/**
 * Send response in appropriate format
 */
function sendResponse(
  res: http.ServerResponse,
  message: JSONRPCMessage | any,
  headers: Record<string, string>,
  clientHeaders: http.IncomingHttpHeaders,
  statusCode: number = 200,
): void {
  // Check if this is an HTTP error response (not JSON-RPC)
  if (message.statusCode && message.body !== undefined && !message.jsonrpc) {
    // This is an HTTP error, return it as-is
    res.writeHead(message.statusCode, headers);
    res.end(message.body);
    return;
  }

  // Otherwise handle as JSON-RPC

  if (clientExpectsSSE(clientHeaders)) {
    // Client expects SSE format
    const { "content-type": _, ...targetHeaders } = headers;
    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...targetHeaders,
    };

    res.writeHead(statusCode, responseHeaders);

    // Format response as SSE
    const sseEvent = formatSSEEvent({
      data: JSON.stringify(message),
    });
    res.end(sseEvent);
  } else {
    // Client expects JSON format
    const { "content-type": _, ...targetHeaders } = headers;
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...targetHeaders,
    };

    res.writeHead(statusCode, responseHeaders);
    res.end(JSON.stringify(message));
  }
}

/**
 * Handle request with hook processing
 */
async function handleWithHooks(
  message: JSONRPCMessage,
  forwardHeaders: Record<string, string>,
  messageHandler: MessageHandler,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const result = await messageHandler.handle(message, forwardHeaders);
  sendResponse(res, result.message, result.headers, req.headers, result.statusCode || 200);
}

/**
 * Handle stream error
 */
function handleStreamError(
  error: Error,
  res: http.ServerResponse,
  requestId: string | number,
): void {
  logger.error(`[MCPHandler] Stream error: ${messageFromError(error)}`);
  if (!res.headersSent) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Stream error",
          data: messageFromError(error),
        },
        id: requestId,
      } as JSONRPCError),
    );
  }
}

/**
 * Handle request with streaming
 */
async function handleWithStreaming(
  request: JSONRPCRequest,
  forwardHeaders: Record<string, string>,
  streamingHandler: StreamingMessageHandler,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const streamResult = await streamingHandler.forwardRequestStreaming(
      request,
      forwardHeaders,
    );

    // Set response headers
    const responseHeaders: Record<string, string> = {
      "Cache-Control": "no-cache",
      ...streamResult.headers,
    };

    res.writeHead(streamResult.statusCode, responseHeaders);

    // Pipe the stream directly to the response
    streamResult.stream.pipe(res);

    // Handle stream errors
    streamResult.stream.on("error", (error) => {
      handleStreamError(error, res, request.id);
    });
  } catch (error) {
    // Handle forward errors
    logger.error(`[MCPHandler] Forward error: ${messageFromError(error)}`);
    const errorStream = streamingHandler.createErrorStream(
      error as Error,
      request.id,
    );
    res.writeHead(500, { "Content-Type": "application/json" });
    errorStream.pipe(res);
  }
}

/**
 * Send internal error response
 */
function sendInternalError(res: http.ServerResponse, error: unknown): void {
  logger.error(`[MCPHandler] Unhandled error: ${messageFromError(error)}`);
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: messageFromError(error),
      },
      id: null,
    }),
  );
}

/**
 * Creates an MCP protocol handler that processes requests
 */
export async function createMCPHandler(options: MCPHandlerOptions) {
  const { config } = options;
  const messageHandler = new MessageHandler(config);
  const streamingHandler = new StreamingMessageHandler(config);

  // Create handler function for HTTP requests
  return async function handleMCPRequest(
    req: http.IncomingMessage & { auth?: AuthInfo },
    res: http.ServerResponse,
  ): Promise<void> {
    logger.info(`[MCPHandler] Incoming HTTP request: ${req.method} ${req.url}`);
    logger.info(`[MCPHandler] Headers: ${JSON.stringify(req.headers)}`);

    try {
      // Validate HTTP method
      if (!validateHttpMethod(req, res)) {
        return;
      }

      // Extract headers to forward
      const forwardHeaders = extractForwardHeaders(req.headers);

      // Handle GET and HEAD requests - no body to parse, forward directly
      if (req.method === "GET" || req.method === "HEAD") {
        // For GET/HEAD requests, we don't have a JSON-RPC message, just forward the request
        if (req.method === "GET") {
          await streamingHandler.forwardGetRequest(req, forwardHeaders, res);
        } else {
          await streamingHandler.forwardHeadRequest(req, forwardHeaders, res);
        }
        return;
      }

      // Handle POST requests - read and parse body
      const body = await readRequestBody(req);
      logger.info(`[MCPHandler] Request body: ${body}`);
      const contentType = req.headers["content-type"];
      logger.info(`[MCPHandler] Content-Type: ${contentType}`);

      // Parse JSON-RPC message
      const message = parseJsonRpcMessage(body, contentType);
      if (!message) {
        logger.error(`[MCPHandler] Failed to parse message from body: ${body}`);
        sendParseError(res);
        return;
      }
      logger.info(`[MCPHandler] Parsed message: ${JSON.stringify(message)}`);

      // Route request based on whether it needs hook processing
      if (needsHookProcessing(message)) {
        await handleWithHooks(
          message,
          forwardHeaders,
          messageHandler,
          req,
          res,
        );
      } else {
        const request = message as JSONRPCRequest;
        await handleWithStreaming(
          request,
          forwardHeaders,
          streamingHandler,
          res,
        );
      }
    } catch (error) {
      sendInternalError(res, error);
    }
  };
}
