/**
 * JSON-RPC Error Handling Utilities
 */

import type { TransportError } from "@civic/hook-common";
import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js";
import type { ForwardResult } from "../hooks/types.js";

/**
 * Type guard to check if an error is an HTTP error
 */
export function isHttpError(
  error: unknown,
): error is { code: number; message?: string; data?: unknown } {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "number" &&
    (error as { code: number }).code >= 400 &&
    (error as { code: number }).code < 600
  );
}

/**
 * Convert HTTP error to ForwardResult
 */
export function httpErrorToForwardResult(error: {
  code: number;
  message?: string;
  data?: unknown;
}): ForwardResult {
  return {
    type: "error",
    error: {
      code: error.code,
      message: error.message || `HTTP ${error.code}`,
      data: error.data,
    },
    headers: {},
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
  code: number,
  message: string,
  data: unknown,
  requestId: string | number | null,
  headers: Record<string, string> = {},
): { message: JSONRPCError; headers: Record<string, string> } {
  return {
    message: {
      jsonrpc: "2.0",
      id: requestId as string | number,
      error: {
        code,
        message,
        data,
      },
    },
    headers,
  };
}

/**
 * Create an error response from a TransportError
 */
export function createErrorResponseFromTransportError(
  error: TransportError,
  requestId: string | number,
  headers: Record<string, string> = {},
): { message: JSONRPCError; headers: Record<string, string> } {
  return createErrorResponse(
    error.code || -32603,
    error.message || "Internal error",
    error.data,
    requestId,
    headers,
  );
}
