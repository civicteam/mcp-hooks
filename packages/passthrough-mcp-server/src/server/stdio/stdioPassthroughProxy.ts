/**
 * Stdio Passthrough Proxy Implementation
 *
 * Provides a stdio transport that forwards messages to a remote server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import type { ServerPassthroughProxy } from "../../types.js";
import { createTransportProxyServer } from "../transport/transportHandler.js";
import type { TransportProxyServer } from "../transport/transportProxyServer.js";

export class StdioPassthroughProxyImpl implements ServerPassthroughProxy {
  server!: TransportProxyServer;
  private isStarted = false;

  constructor(private config: Config & { transportType: "stdio" }) {}

  /**
   * Async initialization method to set up the transport and message handler
   */
  async initialize(): Promise<void> {
    const { server } = await createTransportProxyServer(this.config);
    this.server = server;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("[StdioPassthrough] Server is already started");
      return;
    }

    // create and connect transport
    const transport = new StdioServerTransport();

    await this.server.connect(transport);
    this.isStarted = true;

    logger.info(
      `[StdioPassthrough] Passthrough MCP Server running with stdio transport, connecting to target at ${this.config.target.url}`,
    );
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn("[StdioPassthrough] Server is not started");
      return;
    }

    await this.server.close();
    this.isStarted = false;
    logger.info("[StdioPassthrough] Passthrough MCP Server stopped");
  }
}
