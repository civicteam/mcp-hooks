/**
 * MCP Error Codes Reference
 *
 * This file documents all MCP error codes used throughout the passthrough-mcp-server.
 * Error codes follow the JSON-RPC 2.0 specification with MCP-specific extensions.
 */

/**
 * Standard JSON-RPC 2.0 error codes used by MCP:
 * -32700: Parse error
 * -32600: Invalid Request
 * -32601: Method not found
 * -32602: Invalid params
 * -32603: Internal error
 * -32000 to -32099: Server error (Reserved for implementation-defined server-errors)
 */

/**
 * MCP Error Codes used in passthrough-mcp-server
 */
export const MCP_ERROR_CODES = {
  /**
   * General server error
   * Used in: httpPassthroughProxy.ts
   * Context: HTTP proxy errors, connection failures
   */
  SERVER_ERROR: -32000,

  /**
   * Request rejected by hook or no client transport
   * Used in: mcpErrorUtils.ts, passthroughContext.ts
   * Context: Hook rejection, missing client transport for request forwarding
   */
  REQUEST_REJECTED: -32001,

  /**
   * Response rejected by hook
   * Used in: mcpErrorUtils.ts
   * Context: Hook rejection of response
   */
  RESPONSE_REJECTED: -32002,
} as const;

/**
 * Error messages used throughout the application
 */
export const ERROR_MESSAGES = {
  // Hook-related errors
  REQUEST_REJECTED_BY_HOOK: "Request rejected by hook",
  RESPONSE_REJECTED_BY_HOOK: "Response rejected by hook",

  // Transport-related errors
  NO_CLIENT_TRANSPORT:
    "No client transport connected. Cannot forward request to upstream server.",
  NO_CLIENT_TRANSPORT_NOTIFICATION:
    "No client transport connected. Cannot forward notification to upstream server.",

  // Connection lifecycle errors
  ERROR_CLOSING_CLIENT: "Error trying to close the Passthrough Client",
  ERROR_CLOSING_SERVER: "Error trying to close the Passthrough Server",
} as const;

/**
 * Helper type for error code values
 */
export type McpErrorCode =
  (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

/**
 * Helper type for error messages
 */
export type McpErrorMessage =
  (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES];
