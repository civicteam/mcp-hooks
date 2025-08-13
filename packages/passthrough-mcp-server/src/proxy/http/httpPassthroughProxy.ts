/**
 * HTTP Passthrough Proxy Implementation
 *
 * Provides an HTTP server that routes MCP requests to a remote server.
 * The HTTP server itself is an implementation detail and not exposed.
 */

import type {
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";

import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../../logger/logger.js";
import { PassthroughContext } from "../../shared/passthroughContext.js";
import { RequestContextAwareStreamableHTTPClientTransport } from "../../transports/requestContextAwareStreamableHTTPClientTransport.js";
import type { Config } from "../config.js";
import { createClientTransport, getTargetUrl } from "../transportFactory.js";
import type { PassthroughProxy } from "../types.js";
import { createMcpHttpServer } from "./mcpHttpServer.js";
import { McpSessionManager } from "./mcpSessionManager.js";
import { buildClientHeaders, parseJsonBody } from "./utils.js";

export type HttpProxyConfig = Omit<Config, "source"> & {
  port?: number;
  mcpPath?: string;
  transportFactory?: (
    options: StreamableHTTPServerTransportOptions,
  ) => StreamableHTTPServerTransport;
  autoStart?: boolean;
};

export class HttpPassthroughProxy implements PassthroughProxy {
  private httpServer!: HttpServer;
  private isStarted = false;
  private sessionManager: McpSessionManager;

  constructor(private config: HttpProxyConfig) {
    this.sessionManager = new McpSessionManager();
  }

  protected async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (req.method === "POST") {
      await this.handleResponsePost(req, res);
    } else if (req.method === "GET" || req.method === "DELETE") {
      await this.handleResponseGetDelete(req, res);
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  }

  private async handleResponsePost(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Parse the request body
    // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC body structure is dynamic
    let body: any;
    try {
      body = await parseJsonBody(req);
    } catch (error) {
      logger.error(`Error parsing request body: ${error}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request body" }));
      return;
    }
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      let serverTransport = sessionId
        ? (this.sessionManager.getSession(sessionId)?.context
            .passthroughServerTransport as StreamableHTTPServerTransport)
        : undefined;

      // Store the session
      if (sessionId && serverTransport) {
        // Reuse existing transport
        logger.debug(
          `Reusing existing HTTP transport for session ID: ${sessionId}`,
        );
      } else if (!sessionId && isInitializeRequest(body)) {
        logger.debug("Initializing new HTTP transport");
        // New Session -> new transports and passthrough Context
        const proxyContext = new PassthroughContext(this.config.hooks);

        // Forward all headers except MCP-reserved ones
        const headers = buildClientHeaders(req.headers, this.config.authToken);

        const clientTransport = createClientTransport(
          this.config.target,
          this.config.authToken,
          headers, // Pass custom headers
        );

        const options: StreamableHTTPServerTransportOptions = {
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            // Store the transport by session ID
            this.sessionManager.addSession(newSessionId, proxyContext);
            logger.debug(
              `HTTP transport initialized for session: ${newSessionId}`,
            );
          },
        };

        if (this.config.transportFactory) {
          logger.debug(
            "Creating StreamableHTTPServerTransport with custom factory",
          );
          serverTransport = this.config.transportFactory(options);
        } else {
          serverTransport = new StreamableHTTPServerTransport(options);
        }

        // Clean up transport when closed
        serverTransport.onclose = () => {
          if (serverTransport?.sessionId) {
            logger.debug(
              `HTTP Streaming connection closed for session ${serverTransport.sessionId}`,
            );
            // Remove the session from the session manager, but do not cascade close the transport
            this.sessionManager.removeSession(serverTransport.sessionId);
          }
        };

        // Connect the MCP server to this transport
        await proxyContext.connect(serverTransport, clientTransport);
        logger.debug("New MCP HTTP connection established");
      } else {
        // Invalid request
        logger.error(
          "Invalid MCP HTTP request: No valid session ID provided or not an initialize request",
        );
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message:
                "Bad Request: No valid session ID provided or not an initialize request",
            },
            id: null,
          }),
        );
        return;
      }

      // Ensure we have a valid transport before handling the request
      if (!serverTransport) {
        logger.error("Transport not available for MCP HTTP request");
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Transport not available",
            },
            id: null,
          }),
        );
        return;
      }

      // Handle the request
      await serverTransport.handleRequest(req, res, body);
    } catch (error) {
      logger.error(`Error handling MCP HTTP request: ${error}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to process HTTP request" }));
      }
    }
  }

  private async handleResponseGetDelete(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing session ID" }));
        return;
      }

      const session = this.sessionManager.getSession(sessionId);

      if (!session) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid session ID" }));
        return;
      }

      if (!session.context.passthroughServerTransport) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "Non connected transport on session ID" }),
        );
        return;
      }

      // TODO: How can proxyContext preserve the transport Type?
      await (
        session.context
          .passthroughServerTransport as StreamableHTTPServerTransport
      ).handleRequest(req, res);
    } catch (error) {
      logger.error(`Error handling MCP HTTP GET/DELETE request: ${error}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to process HTTP GET/DELETE request",
          }),
        );
      }
    }
  }

  async initialize(): Promise<void> {
    // Create HTTP proxy server
    this.httpServer = createMcpHttpServer(
      {
        targetUrl: getTargetUrl(this.config.target),
        mcpPath: this.config.mcpPath || "/mcp",
      },
      this.handleRequest.bind(this),
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

    const targetInfo =
      this.config.target.transportType === "custom"
        ? "custom transport"
        : `${getTargetUrl(this.config.target)}`;

    logger.info(
      `[HttpPassthrough] Passthrough MCP Server running with httpStream transport on port ${port}, connecting to target at ${targetInfo}`,
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

    await this.sessionManager.removeAllSessions();

    this.isStarted = false;
    logger.info("[HttpPassthrough] Passthrough MCP Server stopped");
  }
}
