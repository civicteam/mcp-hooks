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
): Promise<{ message: JSONRPCError; headers: Record<string, string> }> {
  const errorResult = await processError();

  if (errorResult.resultType === "abort") {
    // Hook wants to override the error
    return createAbortResponse("error", errorResult.reason, requestId, headers);
  }

  // Continue with the original error (possibly modified by hooks)
  const finalError = errorResult.error || error;
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
  };
}
