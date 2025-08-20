/**
 * McpError Response Creation Utilities
 */

import type { HookChainError } from "@civic/hook-common";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * Create an abort response based on the hook result
 */
export function createAbortException(error: HookChainError): McpError {
  return new McpError(error.code, error.message, error.data);
}
