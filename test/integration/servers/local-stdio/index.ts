#!/usr/bin/env tsx

/**
 * Local MCP server for testing local tools functionality
 *
 * This server implements a single tool (reverse-text) and is used
 * to test the hybrid transport architecture.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create the MCP server
const server = new McpServer(
  {
    name: "local-test-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Add the reverse-text tool
server.tool(
  "reverse-text",
  "Reverses the given text",
  {
    text: {
      type: "string",
      description: "Text to reverse",
    },
  },
  async ({ text }) => {
    console.error(`[LocalServer] reverse-text called with: "${text}"`);

    if (!text) {
      throw new Error("text parameter is required");
    }

    const reversed = text.split("").reverse().join("");

    return {
      content: [
        {
          type: "text",
          text: reversed,
        },
      ],
    };
  },
);

// Main function to start the server
async function main() {
  console.error("[LocalServer] Starting local test server...");
  console.error("[LocalServer] Available tools: reverse-text");

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);

  console.error("[LocalServer] Server running on stdio transport");
  console.error("[LocalServer] Ready to handle requests");
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("\n[LocalServer] Shutting down...");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("\n[LocalServer] Shutting down...");
  await server.close();
  process.exit(0);
});

// Error handling
process.on("uncaughtException", (error) => {
  console.error("[LocalServer] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[LocalServer] Unhandled rejection:", reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("[LocalServer] Failed to start:", error);
  process.exit(1);
});
