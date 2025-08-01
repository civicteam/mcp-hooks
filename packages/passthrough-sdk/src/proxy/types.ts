/**
 * Type definitions for passthrough proxy interfaces
 */

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
