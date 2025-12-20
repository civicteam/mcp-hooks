/**
 * Authentication Proxy Module
 *
 * Simple routing proxy that:
 * - Routes /mcp requests to the MCP handler
 * - Proxies all other requests directly to the target server
 * - Preserves all headers including authorization
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import { logger } from "../../logger/logger.js";

export interface ProxyOptions {
  targetUrl?: string;
  mcpPath: string;
}

/**
 * Creates an HTTP server that routes requests:
 * - /mcp -> MCP handler
 * - Everything else -> proxy to target (if targetUrl provided) or 404
 */
export function createMcpHttpServer(
  options: ProxyOptions,
  mcpHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): http.Server {
  const targetUrl = options.targetUrl ? new URL(options.targetUrl) : null;

  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

    // Route based on path
    if (requestUrl.pathname === options.mcpPath) {
      // Handle MCP requests
      await mcpHandler(req, res);
    } else if (targetUrl) {
      // Proxy all other requests directly to target
      await proxyToTarget(req, res, targetUrl);
    } else {
      // No target URL configured (custom transport), return 404 for non-MCP paths
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });
}

/**
 * Proxies a request directly to the target server
 */
async function proxyToTarget(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetUrl: URL,
): Promise<void> {
  try {
    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host, // Update host header to target
      },
    };

    logger.debug(`Proxying ${req.method} ${req.url} to ${targetUrl.host}`);

    const protocol = targetUrl.protocol === "https:" ? https : http;
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Forward status and headers from target
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

      // Forward response body
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      logger.error(`Proxy request error: ${err}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end("Bad Gateway");
      }
    });

    // Forward request body
    req.pipe(proxyReq);
  } catch (err) {
    logger.error(`Error in proxy request: ${err}`);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }
}
