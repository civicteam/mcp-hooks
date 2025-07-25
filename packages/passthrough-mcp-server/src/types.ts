/**
 * Type definitions for passthrough proxy interfaces
 */

import type { TransportProxyServer } from "./server/transport/transportProxyServer.js";

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
 * Transport agnostic passthrough proxy interface
 * Exposes the Protocol implementation for advanced use cases
 */
export interface ServerPassthroughProxy extends PassthroughProxy {
  /**
   * The underlying server
   */
  server: TransportProxyServer;
}

/**
 * HTTP-specific passthrough proxy interface
 * No additional public properties - HTTP server is an implementation detail
 */
export interface HttpPassthroughProxy extends PassthroughProxy {
  // Intentionally empty - HTTP server is not exposed
}
