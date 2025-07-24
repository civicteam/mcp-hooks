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
} from "./createProxies.js";

// Export types
export type {
  PassthroughProxy,
  StdioPassthroughProxy,
  HttpPassthroughProxy,
} from "./types.js";

export type {
  StdioProxyConfig,
  HttpProxyConfig,
} from "./createProxies.js";

// Export config types
export type {
  Config,
  TargetConfig,
  BaseConfig,
  HookDefinition,
  RemoteHookConfig,
} from "./lib/config.js";

// Export hook-related types and interfaces
export type {
  Hook,
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  LocalHookClient,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
} from "@civic/hook-common";

export { AbstractHook } from "@civic/hook-common";

// Export hook processor functions
export {
  processRequestThroughHooks,
  processResponseThroughHooks,
  processTransportErrorThroughHooks,
} from "./hooks/processor.js";

// Export hook utilities
export { getHookClients } from "./hooks/manager.js";
export { createHookClient, createHookClients } from "./hooks/utils.js";

// Export utility functions that users might need
export { loadConfig } from "./lib/config.js";

// Export HTTP handler creation function
export { createMCPHandler } from "./server/http/mcpHandler.js";
export type { MCPHandlerOptions } from "./server/http/mcpHandler.js";
