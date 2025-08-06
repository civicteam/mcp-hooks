/**
 * Example: Programmatic Usage of Passthrough MCP Server
 *
 * This example demonstrates how to use the passthrough MCP server
 * programmatically in your own applications.
 */

import {
  AbstractHook,
  type CallToolRequest,
  type CallToolResult,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
} from "@civic/hook-common";
import { createPassthroughProxy } from "../src/index.js";
import { logger } from "../src/logger/logger.js";

async function example1_basicUsage() {
  logger.info("Example 1: Basic Usage");

  // Create and start the proxy
  const proxy = await createPassthroughProxy({
    sourceTransportType: "httpStream",
    port: 34000,
    target: {
      url: "http://localhost:33000",
      transportType: "httpStream",
    },
  });

  logger.info("Passthrough proxy is running!");

  // Stop after 10 seconds
  setTimeout(async () => {
    await proxy.stop();
    logger.info("Proxy stopped");
  }, 10000);
}

async function example2_manualStart() {
  logger.info("\nExample 2: Manual Start");

  // Create without auto-starting
  const proxy = await createPassthroughProxy({
    sourceTransportType: "httpStream",
    port: 34001,
    target: {
      url: "http://localhost:33001",
      transportType: "httpStream",
    },
    autoStart: false,
  });

  logger.info("Proxy created but not started");

  // Start manually after some setup
  logger.info("Starting proxy...");
  await proxy.start();
  logger.info("Proxy is now running!");
}

async function example3_withRemoteHooks() {
  logger.info("\nExample 3: With Remote Hooks");

  const proxy = await createPassthroughProxy({
    sourceTransportType: "httpStream",
    port: 34002,
    target: {
      url: "http://localhost:33002",
      transportType: "httpStream",
    },
    hooks: [
      {
        url: "http://localhost:8080/trpc",
        name: "audit-hook",
      },
      {
        url: "http://localhost:8081/trpc",
        name: "filter-hook",
      },
    ],
  });
  logger.info("Proxy running with remote hooks configured");
}

async function example4_withProgrammaticHooks() {
  logger.info("\nExample 4: With Programmatic Hooks");

  // Create a simple logging hook
  class LoggingHook extends AbstractHook {
    get name(): string {
      return "LoggingHook";
    }

    async processToolCallRequest(
      toolCall: CallToolRequest,
    ): Promise<ToolCallRequestHookResult> {
      logger.info(
        `[${this.name}] Tool request: ${toolCall.params.name} ${JSON.stringify(toolCall.params.arguments)}`,
      );
      return {
        resultType: "continue",
        request: toolCall,
      };
    }

    async processToolCallResponse(
      response: CallToolResult,
      originalToolCall: CallToolRequest,
    ): Promise<ToolCallResponseHookResult> {
      logger.info(
        `[${this.name}] Tool response for ${originalToolCall.params.name}: ${JSON.stringify(response)}`,
      );
      return {
        resultType: "continue",
        response,
      };
    }
  }

  // Create a validation hook
  class ValidationHook extends AbstractHook {
    get name(): string {
      return "ValidationHook";
    }

    async processToolCallRequest(
      toolCall: CallToolRequest,
    ): Promise<ToolCallRequestHookResult> {
      // Block dangerous operations
      if (
        toolCall.params.name.toLowerCase().includes("delete") ||
        toolCall.params.name.toLowerCase().includes("remove")
      ) {
        return {
          resultType: "abort",
          reason: "Dangerous operations are not allowed",
        };
      }

      return {
        resultType: "continue",
        request: toolCall,
      };
    }
  }

  // Mix programmatic hooks with remote hooks
  const proxy = await createPassthroughProxy({
    sourceTransportType: "httpStream",
    port: 34002,
    target: {
      url: "http://localhost:33002",
      transportType: "httpStream",
    },
    hooks: [
      new LoggingHook(), // Programmatic hook instance
      new ValidationHook(), // Another programmatic hook
      {
        // Remote hook
        url: "http://localhost:8080/trpc",
        name: "remote-audit-hook",
      },
    ],
  });

  logger.info("Proxy running with both programmatic and remote hooks");
}

async function example5_stdioProxy() {
  // Note: When using stdio transport, all logging is sent to stderr
  // to avoid interfering with the stdio protocol communication
  logger.info("\nExample 5: Stdio Proxy");

  // Example of stdio proxy (useful for direct command-line integration)
  const proxy = await createPassthroughProxy({
    sourceTransportType: "stdio",
    target: {
      url: "http://localhost:33003",
      transportType: "httpStream",
    },
  });

  // These messages are sent to stderr when using stdio transport
  logger.info("Stdio proxy is running!");
  logger.info("The proxy will forward stdio input/output to the HTTP target");
}

// Run examples based on command line argument
const exampleNumber = process.argv[2] || "1";

switch (exampleNumber) {
  case "1":
    example1_basicUsage().catch((err) => logger.error(String(err)));
    break;
  case "2":
    example2_manualStart().catch((err) => logger.error(String(err)));
    break;
  case "3":
    example3_withRemoteHooks().catch((err) => logger.error(String(err)));
    break;
  case "4":
    example4_withProgrammaticHooks().catch((err) => logger.error(String(err)));
    break;
  case "5":
    example5_stdioProxy().catch((err) => logger.error(String(err)));
    break;
  default:
    logger.info("Usage: tsx programmatic-usage.ts [1|2|3|4|5]");
    logger.info("1 - Basic usage");
    logger.info("2 - Manual start");
    logger.info("3 - With remote hooks");
    logger.info("4 - With programmatic hooks");
    logger.info("5 - Stdio proxy");
}
