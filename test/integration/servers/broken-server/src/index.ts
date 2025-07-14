#!/usr/bin/env tsx
/**
 * Broken MCP Server - Always returns 500 errors
 *
 * This server is used for testing error handling in the passthrough proxy.
 * It always returns a 500 Internal Server Error for any request.
 */

import { createServer } from "node:http";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33200;

// Create an HTTP server that always returns 500
const server = createServer((req, res) => {
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("Internal Server Error");
});

server.listen(PORT, () => {
  console.log(`[BrokenServer] Listening on port ${PORT}`);
  console.log(
    "[BrokenServer] This server always returns 500 errors for testing",
  );
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[BrokenServer] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
