/**
 * Stdio Passthrough Proxy Implementation
 *
 * Provides a stdio transport that forwards messages to a remote server
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { logger } from "../../logger/logger.js";
import { PassthroughContext } from "../../shared/passthroughContext.js";
import type { Config } from "../config.js";
import { createClientTransport } from "../transportFactory.js";
import type { PassthroughProxy } from "../types.js";

export class StdioPassthroughProxy implements PassthroughProxy {
  private isStarted = false;

  private proxyContext: PassthroughContext;
  private serverTransport: StdioServerTransport;
  private clientTransport: Transport;

  constructor(private config: Config & { sourceTransportType: "stdio" }) {
    this.serverTransport = new StdioServerTransport();
    this.clientTransport = createClientTransport(
      this.config.target,
      this.config.authToken,
    );
    this.proxyContext = new PassthroughContext(config.hooks);
  }

  /**
   * Async initialization method to set up the transport and message handler
   */
  async initialize(): Promise<void> {
    // nothing to do.
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("[StdioPassthrough] Server is already started");
      return;
    }

    await this.proxyContext.connect(this.serverTransport, this.clientTransport);

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

    await this.proxyContext.close();
    this.isStarted = false;
    logger.info("[StdioPassthrough] Passthrough MCP Server stopped");
  }
}
