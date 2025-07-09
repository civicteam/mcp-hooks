#!/usr/bin/env node

/**
 * CLI entry point for the passthrough MCP server
 *
 * This file contains the command-line interface logic for running
 * the passthrough MCP server as a standalone application.
 */

import {
  createHttpPassthroughProxy,
  createStdioPassthroughProxy,
} from "./createProxies.js";
import { loadConfig } from "./utils/config.js";
import { logger } from "./utils/logger.js";

/**
 * Main function to start the passthrough MCP server
 */
async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Create and start the passthrough proxy based on transport type
    const proxy =
      config.transportType === "stdio"
        ? await createStdioPassthroughProxy({
            ...config,
            autoStart: true,
          })
        : await createHttpPassthroughProxy({
            ...config,
            port: config.port || 3000,
            autoStart: true,
          });

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down passthrough MCP server...");
      await proxy.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
