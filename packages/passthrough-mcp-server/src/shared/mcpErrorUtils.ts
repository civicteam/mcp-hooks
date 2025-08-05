/**
 * McpError Response Creation Utilities
 */

import { McpError } from "@modelcontextprotocol/sdk/types.js";

type ResponseType = "request" | "response";

/**
 * Create an abort response based on the hook result
 */
export function createAbortException(
  responseType: ResponseType,
  reason: string | undefined,
): McpError {
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
  }

  return new McpError(code, reason || defaultMessage);
}
