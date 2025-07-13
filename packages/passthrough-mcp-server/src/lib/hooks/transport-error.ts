/**
 * Hook Transport Error Handling Utilities
 */

import type { TransportError } from "@civic/hook-common";
import type { JSONRPCError } from "@modelcontextprotocol/sdk/types.js";
import { createAbortResponse } from "../jsonrpc/responses.js";

/**
 * Handle transport errors through hooks and return appropriate JSON-RPC error
 */
export async function handleTransportError<
  T extends { resultType: string; error?: TransportError; reason?: string },
>(
  error: TransportError,
  requestId: string | number,
  headers: Record<string, string>,
  processError: () => Promise<T>,
): Promise<{
  message: JSONRPCError | { statusCode: number; body: string };
  headers: Record<string, string>;
  statusCode?: number;
}> {
  const errorResult = await processError();

  if (errorResult.resultType === "abort") {
    // Hook wants to override the error
    const abortResponse = createAbortResponse(
      "error",
      errorResult.reason,
      requestId,
      headers,
    );
    return {
      ...abortResponse,
      statusCode: 200, // Abort responses are JSON-RPC errors
    };
  }

  // Continue with the original error (possibly modified by hooks)
  const finalError = errorResult.error || error;

  // Check responseType to determine how to return the error
  if (finalError.responseType === "http") {
    // Return as HTTP error
    return {
      message: {
        statusCode: finalError.code,
        body: (finalError.data as string) || finalError.message,
      } as any, // Type assertion needed for HTTP response
      headers,
      statusCode: finalError.code,
    };
  }

  // Return as JSON-RPC error (default)
  return {
    message: {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: finalError.code || -32603,
        message: finalError.message || "Internal error",
        data: finalError.data,
      },
    },
    headers,
    statusCode: 200, // JSON-RPC errors use 200 status
  };
}
