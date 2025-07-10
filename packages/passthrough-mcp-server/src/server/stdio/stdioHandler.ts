/**
 * Stdio Handler Module
 *
 * Provides stdio transport handling using the ProxyStdioServerTransport
 * for transparent message forwarding to HTTP targets.
 */

import type { Config } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";
import type { MessageHandler } from "../messageHandler.js";
import { ProxyStdioServerTransport } from "./ProxyStdioServerTransport.js";

/**
 * Create and configure stdio transport with protocol forwarder
 */
export async function createStdioServer(config: Config): Promise<{
  transport: ProxyStdioServerTransport;
  messageHandler: MessageHandler;
}> {
  // Create the proxy transport
  const transport = new ProxyStdioServerTransport(config);

  // Log transport errors
  transport.onerror = (error: Error) => {
    logger.error(`Stdio transport error: ${error.message}`);
  };

  // Handle transport close
  transport.onclose = () => {
    logger.info("Stdio transport closed");
  };

  return { transport, messageHandler: transport.getMessageHandler() };
}
