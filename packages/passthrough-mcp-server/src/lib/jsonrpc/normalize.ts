/**
 * JSON-RPC Response Normalization Utilities
 */

import type {
  JSONRPCError,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import type { ForwardResult } from "../hooks/types.js";

/**
 * Normalize a response into either a success or error ForwardResult
 */
export function normalizeResponse(
  response: JSONRPCResponse | JSONRPCError,
  headers: Record<string, string>,
): ForwardResult {
  // Check if the response contains a JSON-RPC error
  if ("error" in response) {
    // This is a JSON-RPC error, treat it as a transport error
    return {
      type: "error",
      error: {
        code: response.error.code,
        message: response.error.message,
        data: response.error.data,
      },
      headers,
    };
  }

  // This is a successful response
  return {
    type: "success",
    result: response.result,
    headers,
  };
}
