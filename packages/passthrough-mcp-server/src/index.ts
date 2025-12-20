/**
 * Passthrough MCP Server Library
 *
 * This module exports the public API for programmatically creating
 * and controlling passthrough MCP servers.
 *
 * For CLI usage, see cli.ts
 */

// Export hook-related types and interfaces
export type {
  CallToolRequest,
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  CallToolResult,
  Hook,
  ListToolsRequest,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ListToolsResult,
  LocalHookClient,
} from "@civic/hook-common";
export { AbstractHook } from "@civic/hook-common";
export type { McpErrorCode, McpErrorMessage } from "./error/errorCodes.js";
// Export error constants
export { ERROR_MESSAGES, MCP_ERROR_CODES } from "./error/errorCodes.js";
// Export hook utilities
export { getHookClients } from "./hook/manager.js";
// Export hook processor functions
export {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "./hook/processor.js";
export { createHookClient, createHookClients } from "./hook/utils.js";
// Export config types
export type {
  Config,
  HookDefinition,
  RemoteHookConfig,
  SourceConfig,
  TargetConfig,
} from "./proxy/config.js";
// Export utility functions that users might need
export { loadConfig } from "./proxy/config.js";
// Export transport-specific factory functions
export {
  createHttpPassthroughProxy,
  createPassthroughProxy,
  createStdioPassthroughProxy,
} from "./proxy/createProxies.js";
export type { HttpProxyConfig } from "./proxy/http/httpPassthroughProxy.js";
export type { StdioProxyConfig } from "./proxy/stdio/stdioPassthroughProxy.js";
// Export types
export type { PassthroughProxy } from "./proxy/types.js";

export {
  MetadataHelper,
  type PassthroughMetadata,
} from "./shared/metadataHelper.js";
// Export core passthrough classes and interfaces
export {
  PassthroughContext,
  type PassthroughContextOptions,
  type TransportInterface,
} from "./shared/passthroughContext.js";
// Export custom transports
export { RequestContextAwareStreamableHTTPClientTransport } from "./transports/requestContextAwareStreamableHTTPClientTransport.js";
