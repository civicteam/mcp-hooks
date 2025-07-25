/**
 * Custom Transport Passthrough Proxy Implementation
 *
 * Uses a Custom Transport transport that forwards messages to a remote server
 */

import type { Config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import type { ServerPassthroughProxy } from "../../types.js";
import { createTransportProxyServer } from "./transportHandler.js";
import type { TransportProxyServer } from "./transportProxyServer.js";

export class TransportPassthroughProxyImpl implements ServerPassthroughProxy {
  server!: TransportProxyServer;
  private isStarted = false;

  constructor(private config: Config & { transportType: "custom" }) {}

  /**
   * Async initialization method to set up the transport and message handler
   */
  async initialize(): Promise<void> {
    const { server } = await createTransportProxyServer(this.config);
    this.server = server;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("[ServerPassthroughProxy] Server is already started");
      return;
    }

    await this.server.connect(this.config.transport);
    this.isStarted = true;

    logger.info(
      `[ServerPassthroughProxy] Passthrough MCP Server running with stdio transport, connecting to target at ${this.config.target.url}`,
    );
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn("[ServerPassthroughProxy] Server is not started");
      return;
    }

    await this.server.close();
    this.isStarted = false;
    logger.info("[ServerPassthroughProxy] Passthrough MCP Server stopped");
  }
}
