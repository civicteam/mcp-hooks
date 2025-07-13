/**
 * JSON-RPC Response Creation Utilities
 */

import type {
  JSONRPCError,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";

export type ResponseType = "request" | "response" | "error";

/**
 * Create an abort response based on the hook result
 */
export function createAbortResponse(
  responseType: ResponseType,
  reason: string | undefined,
  requestId: string | number,
  headers: Record<string, string>,
): {
  message: JSONRPCError;
  headers: Record<string, string>;
  statusCode?: number;
} {
  // Determine error code and default message based on response type
  let code: number;
  let defaultMessage: string;

  switch (responseType) {
    case "request":
      code = -32001; // MCP-specific error code for request rejection
      defaultMessage = "Request rejected by hook";
      break;
    case "response":
      code = -32603; // Internal error (response was rejected)
      defaultMessage = "Response rejected by hook";
      break;
    case "error":
      code = -32603; // Internal error (error processing was aborted)
      defaultMessage = "Error processing aborted by hook";
      break;
  }

  return {
    message: {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code,
        message: reason || defaultMessage,
      },
    },
    headers,
    statusCode: 200, // JSON-RPC errors use 200 status
  };
}

/**
 * Create a successful response
 */
export const createSuccessResponse = (
  result: Record<string, unknown>,
  requestId: string | number,
  headers: Record<string, string>,
): {
  message: JSONRPCResponse;
  headers: Record<string, string>;
  statusCode?: number;
} => ({
  message: {
    jsonrpc: "2.0",
    id: requestId,
    result,
  },
  headers,
  statusCode: 200,
});
