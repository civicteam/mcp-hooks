/**
 * McpError Response Creation Utilities
 */

import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ERROR_MESSAGES, MCP_ERROR_CODES } from "./errorCodes.js";

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
      code = MCP_ERROR_CODES.REQUEST_REJECTED;
      defaultMessage = ERROR_MESSAGES.REQUEST_REJECTED_BY_HOOK;
      break;
    case "response":
      code = MCP_ERROR_CODES.RESPONSE_REJECTED;
      defaultMessage = ERROR_MESSAGES.RESPONSE_REJECTED_BY_HOOK;
      break;
  }

  return new McpError(code, reason || defaultMessage);
}
