/**
 * HTTP Passthrough Proxy Implementation
 *
 * Provides an HTTP server that routes MCP requests to a remote server.
 * The HTTP server itself is an implementation detail and not exposed.
 */

import * as crypto from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { URL } from "node:url";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../../logger/logger.js";
import { PassthroughContext } from "../../shared/passthroughContext.js";
import type { Config } from "../config.js";
import type { PassthroughProxy } from "../types.js";
import { createAuthProxyServer } from "./authProxy.js";

export class HttpPassthroughProxy implements PassthroughProxy {
  private httpServer!: HttpServer;
  private isStarted = false;

  private targetUrl: string;
  private targetMcpPath: string;

  private proxyContext: PassthroughContext;
  private serverTransport: StreamableHTTPServerTransport;
  private clientTransport: StreamableHTTPClientTransport;

  constructor(private config: Config & { transportType: "httpStream" }) {
    // TODO: This is a reimplementation of the existing logic. This ALWAYS uses the same Transport (which is likely not
    // what we want).
    this.serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    this.targetUrl = config.target.url;
    this.targetMcpPath = config.target.mcpPath || "/mcp";
    this.clientTransport = new StreamableHTTPClientTransport(
      new URL(this.targetUrl + this.targetMcpPath),
      {
        requestInit: {
          headers: config.authToken
            ? { Authorization: `Bearer ${config.authToken}` }
            : undefined,
        },
      },
    );
    this.proxyContext = new PassthroughContext(config.hooks);
  }

  async initialize(): Promise<void> {
    // Create HTTP proxy server
    this.httpServer = createAuthProxyServer(
      {
        targetUrl: this.config.target.url,
        mcpEndpoint: "/mcp",
      },
      this.serverTransport.handleRequest,
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

    await this.proxyContext.connect(this.serverTransport, this.clientTransport);

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

    await this.proxyContext.close();

    this.isStarted = false;
    logger.info("[HttpPassthrough] Passthrough MCP Server stopped");
  }
}
