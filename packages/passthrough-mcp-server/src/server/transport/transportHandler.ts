/**
 * Transport Handler Module
 *
 * Provides transport proxy handling using the TransportProxyServer
 * for transparent message forwarding to HTTP targets.
 */

import type { Config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { TransportProxyServer } from "./transportProxyServer.js";

/**
 * Create and configure transport proxy with protocol forwarder
 */
export async function createTransportProxyServer(config: Config): Promise<{
  server: TransportProxyServer;
}> {
  // Create the proxy transport
  const server = new TransportProxyServer(config);

  // Log transport errors
  server.onerror = (error: Error) => {
    logger.error(`Proxy Server error: ${error.message}`);
  };

  // Handle transport close
  server.onclose = () => {
    logger.info("Proxy Server closed");
  };

  return { server };
}
