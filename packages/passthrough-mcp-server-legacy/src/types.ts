/**
 * Type definitions for passthrough proxy interfaces
 */

import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Base interface for all passthrough proxy implementations
 * Provides minimal lifecycle management
 */
export interface PassthroughProxy {
  /**
   * Start the proxy server
   */
  start(): Promise<void>;

  /**
   * Stop the proxy server
   */
  stop(): Promise<void>;
}

/**
 * Stdio-specific passthrough proxy interface
 * Exposes the transport for advanced use cases
 */
export interface StdioPassthroughProxy extends PassthroughProxy {
  /**
   * The underlying stdio transport
   */
  transport: StdioServerTransport;
}

/**
 * HTTP-specific passthrough proxy interface
 * No additional public properties - HTTP server is an implementation detail
 */
export interface HttpPassthroughProxy extends PassthroughProxy {
  // Intentionally empty - HTTP server is not exposed
}
