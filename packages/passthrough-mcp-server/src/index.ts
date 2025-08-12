/**
 * Passthrough MCP Server Library
 *
 * This module exports the public API for programmatically creating
 * and controlling passthrough MCP servers.
 *
 * For CLI usage, see cli.ts
 */

// Export transport-specific factory functions
export {
  createStdioPassthroughProxy,
  createHttpPassthroughProxy,
  createPassthroughProxy,
} from "./proxy/createProxies.js";

// Export types
export type { PassthroughProxy } from "./proxy/types.js";

export type {
  StdioProxyConfig,
  HttpProxyConfig,
} from "./proxy/createProxies.js";

// Export config types
export type {
  Config,
  TargetConfig,
  BaseConfig,
  HookDefinition,
  RemoteHookConfig,
} from "./proxy/config.js";

// Export hook-related types and interfaces
export type {
  Hook,
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  LocalHookClient,
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
} from "@civic/hook-common";

export { AbstractHook } from "@civic/hook-common";

// Export hook processor functions
export {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "./hook/processor.js";

// Export hook utilities
export { getHookClients } from "./hook/manager.js";
export { createHookClient, createHookClients } from "./hook/utils.js";

// Export utility functions that users might need
export { loadConfig } from "./proxy/config.js";

// Export custom transports
export { RequestContextAwareStreamableHTTPClientTransport } from "./transports/requestContextAwareStreamableHTTPClientTransport.js";

// Export core passthrough classes
export { PassthroughContext } from "./shared/passthroughContext.js";

// Export error constants
export { MCP_ERROR_CODES, ERROR_MESSAGES } from "./error/errorCodes.js";
export type { McpErrorCode, McpErrorMessage } from "./error/errorCodes.js";
