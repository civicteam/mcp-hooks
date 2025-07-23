/**
 * Hook Transport Error Handling Utilities
 */

import type {
  GenericTransportErrorHookResult,
  TransportError,
} from "@civic/hook-common";
import type {
  JSONRPCError,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import { createAbortResponse } from "../jsonrpc/responses.js";
import type { HttpErrorResponse } from "./types.js";

/**
 * Handle transport errors through hooks and return appropriate JSON-RPC error
 */
export async function handleTransportError(
  error: TransportError,
  requestId: string | number,
  headers: Record<string, string>,
  processError: () => Promise<
    GenericTransportErrorHookResult<JSONRPCResponse> & {
      lastProcessedIndex: number;
    }
  >,
): Promise<{
  message: JSONRPCError | HttpErrorResponse | JSONRPCResponse;
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

  if (errorResult.resultType === "respond") {
    // Hook has handled the error and provided a response
    // Wrap the response in proper JSON-RPC format
    return {
      message: {
        jsonrpc: "2.0",
        id: requestId,
        result: errorResult.response,
      } as JSONRPCResponse,
      headers: headers,
      statusCode: 200,
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
      },
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
