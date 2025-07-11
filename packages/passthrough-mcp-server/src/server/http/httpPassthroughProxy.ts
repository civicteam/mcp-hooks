/**
 * HTTP Passthrough Proxy Implementation
 *
 * Provides an HTTP server that routes MCP requests to a remote server.
 * The HTTP server itself is an implementation detail and not exposed.
 */

import * as crypto from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import type { HttpPassthroughProxy } from "../../types.js";
import { createAuthProxyServer } from "./authProxy.js";
import { createMCPHandler } from "./mcpHandler.js";

export class HttpPassthroughProxyImpl implements HttpPassthroughProxy {
  private httpServer!: HttpServer;
  private mcpHandler!: Awaited<ReturnType<typeof createMCPHandler>>;
  private isStarted = false;

  constructor(private config: Config & { transportType: "httpStream" }) {}

  async initialize(): Promise<void> {
    // Create MCP handler
    this.mcpHandler = await createMCPHandler({
      config: this.config,
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    // Create HTTP proxy server
    this.httpServer = createAuthProxyServer(
      {
        targetUrl: this.config.target.url,
        mcpEndpoint: "/mcp",
      },
      this.mcpHandler,
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn("[HttpPassthrough] Server is already started");
      return;
    }

    if (!this.httpServer) {
      await this.initialize();
    }

    const port = this.config.port || 3000;
    await new Promise<void>((resolve, reject) => {
      this.httpServer.on("error", reject);
      this.httpServer.listen(port, () => {
        this.httpServer.off("error", reject);
        resolve();
      });
    });

    this.isStarted = true;

    logger.info(
      `[HttpPassthrough] Passthrough MCP Server running with ${this.config.transportType} transport on port ${port}, connecting to target at ${this.config.target.url}`,
    );
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn("[HttpPassthrough] Server is not started");
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.isStarted = false;
    logger.info("[HttpPassthrough] Passthrough MCP Server stopped");
  }
}
