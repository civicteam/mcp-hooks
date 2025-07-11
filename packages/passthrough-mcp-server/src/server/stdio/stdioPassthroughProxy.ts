/**
 * Stdio Passthrough Proxy Implementation
 *
 * Provides a stdio transport that forwards messages to a remote server
 */

import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import type { StdioPassthroughProxy } from "../../types.js";
import { createStdioServer } from "./stdioHandler.js";

export class StdioPassthroughProxyImpl implements StdioPassthroughProxy {
  transport!: StdioServerTransport;
  private isStarted = false;

  constructor(private config: Config & { transportType: "stdio" }) {}

  /**
   * Async initialization method to set up the transport and message handler
   */
  async initialize(): Promise<void> {
    const { transport } = await createStdioServer(this.config);
    this.transport = transport;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("[StdioPassthrough] Server is already started");
      return;
    }

    await this.transport.start();
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

    await this.transport.close();
    this.isStarted = false;
    logger.info("[StdioPassthrough] Passthrough MCP Server stopped");
  }
}
