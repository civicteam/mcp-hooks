/**
 * Streaming Message Handler Module
 *
 * Provides streaming support for SSE responses while maintaining
 * compatibility with regular JSON responses.
 */

import * as http from "node:http";
import * as https from "node:https";
import { Readable } from "node:stream";
import { URL } from "node:url";
import type { JSONRPCError, JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { messageFromError } from "../utils/error.js";

export interface StreamingResult {
  stream: Readable;
  headers: Record<string, string>;
  isSSE: boolean;
}

export class StreamingMessageHandler {
  private targetUrl: string;
  private targetMcpPath: string;

  constructor(private config: Config) {
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";
  }

  /**
   * Extract response headers excluding connection-specific ones
   */
  private extractResponseHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
    const responseHeaders: Record<string, string> = {};
    const excludeHeaders = ['connection', 'transfer-encoding', 'content-encoding', 'content-length'];
    
    Object.entries(headers).forEach(([key, value]) => {
      if (!excludeHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        responseHeaders[key] = value;
      }
    });
    
    return responseHeaders;
  }

  /**
   * Make HTTP request with appropriate module
   */
  private makeHttpRequest(
    options: http.RequestOptions,
    targetUrlObj: URL,
  ): http.ClientRequest {
    const httpModule = targetUrlObj.protocol === 'https:' ? https : http;
    return httpModule.request(options);
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
    logger.info(`[StreamingMessageHandler] Forward headers: ${JSON.stringify(headers)}`);

    return new Promise<StreamingResult>((resolve, reject) => {
      try {
        const targetUrlObj = new URL(fullTargetUrl);
        const requestBody = JSON.stringify(request);
        
        const options: http.RequestOptions = {
          hostname: targetUrlObj.hostname,
          port: targetUrlObj.port,
          path: targetUrlObj.pathname + targetUrlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            ...headers,
            'Content-Length': Buffer.byteLength(requestBody),
          },
        };

        const req = this.makeHttpRequest(options, targetUrlObj);
        
        req.on('response', (res) => {
          logger.info(`[StreamingMessageHandler] Response status: ${res.statusCode}`);
          
          // Check for error status codes
          if (!res.statusCode || res.statusCode >= 400) {
            // Collect error body
            let errorBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              errorBody += chunk;
            });
            res.on('end', () => {
              reject(new Error(`HTTP ${res.statusCode}: ${errorBody}`));
            });
            return;
          }
          
          // Extract response headers
          const responseHeaders = this.extractResponseHeaders(res.headers);
          logger.info(`[StreamingMessageHandler] Response headers: ${JSON.stringify(responseHeaders)}`);

          // Check if this is an SSE response
          const contentType = res.headers['content-type'] || '';
          const isSSE = contentType.includes('text/event-stream');

          // Return the response stream directly
          resolve({
            stream: res,
            headers: responseHeaders,
            isSSE,
          });
        });
        
        req.on('error', (error) => {
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