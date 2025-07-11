#!/usr/bin/env tsx
/**
 * Broken MCP Server - Always returns 500 errors
 * 
 * This server is used for testing error handling in the passthrough proxy.
 * It always returns a 500 Internal Server Error for any request.
 */

import { createServer } from "http";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 33200;

// Create an HTTP server that handles initialization but fails on tool operations
const server = createServer(async (req, res) => {
  console.log(`[BrokenServer] Received ${req.method} ${req.url}`);
  
  // Read request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const request = JSON.parse(body);
      console.log(`[BrokenServer] Request: ${JSON.stringify(request)}`);
      
      // Handle initialize request normally
      if (request.method === 'initialize') {
        res.writeHead(200, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "broken-server",
              version: "1.0.0"
            }
          }
        }));
        return;
      }
      
      // Handle tools/list to advertise our broken tool
      if (request.method === 'tools/list') {
        res.writeHead(200, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: [{
              name: "always_error",
              description: "A tool that always returns an error",
              inputSchema: {
                type: "object",
                properties: {},
              }
            }]
          }
        }));
        return;
      }
      
      // For all other requests (including tools/call), return 500
      res.writeHead(500, {
        "Content-Type": "application/json",
      });
      
      const errorResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal Server Error - This server is intentionally broken",
          data: {
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method,
          }
        },
        id: request.id || null,
      };
      
      res.end(JSON.stringify(errorResponse));
    } catch (e) {
      // If we can't parse the request, return 500
      res.writeHead(500, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "Parse error",
          data: e instanceof Error ? e.message : String(e)
        },
        id: null,
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[BrokenServer] Listening on port ${PORT}`);
  console.log("[BrokenServer] This server always returns 500 errors for testing");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[BrokenServer] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});