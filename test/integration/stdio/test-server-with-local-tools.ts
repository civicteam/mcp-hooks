#!/usr/bin/env tsx

/**
 * Test server that demonstrates using LocalToolsHook
 * to add local tools to a stdio passthrough proxy
 */

import { LocalToolsHook } from "@civic/local-tools-hook";
import type { ToolDefinition } from "@civic/local-tools-hook";
import { createStdioPassthroughProxy } from "@civic/passthrough-mcp-server";
import { z } from "zod";

async function main() {
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33100";
  const targetTransport = process.env.TARGET_SERVER_TRANSPORT || "httpStream";

  console.error(
    "[Test Server] Starting with target:",
    targetUrl,
    targetTransport,
  );

  // Define local tools
  const localTools: ToolDefinition<any>[] = [];

  // Add local reverse tool
  localTools.push({
    name: "local-reverse",
    description: "Reverses a string locally",
    paramsSchema: {
      text: z.string().describe("Text to reverse"),
    },
    cb: async (args) => {
      console.error(
        "[Test Server] local-reverse called with args:",
        JSON.stringify(args),
      );
      const text = args?.text;
      if (!text) {
        throw new Error("text parameter is required");
      }
      return {
        content: [
          {
            type: "text" as const,
            text: text.split("").reverse().join(""),
          },
        ],
      };
    },
  });

  // Add a tool that always errors for testing
  localTools.push({
    name: "local-error",
    description: "A tool that always fails",
    paramsSchema: {},
    cb: async () => {
      throw new Error("This tool always fails");
    },
  });

  // Check if we should add an override for the echo tool
  if (process.argv.includes("echo")) {
    localTools.push({
      name: "echo",
      description: "Local echo tool that overrides the remote one",
      paramsSchema: {
        message: z.string().describe("Message to echo"),
      },
      cb: async (args) => {
        console.error(
          "[Test Server] local echo called with args:",
          JSON.stringify(args),
        );
        const message = args?.message;
        return {
          content: [
            {
              type: "text" as const,
              text: `LOCAL: ${message}`,
            },
          ],
        };
      },
    });
  }

  // Create LocalToolsHook with our tools
  const localToolsHook = new LocalToolsHook(localTools);

  // Create stdio passthrough proxy with the hook
  const proxy = await createStdioPassthroughProxy({
    target: {
      url: targetUrl,
      transportType: targetTransport as any,
    },
    serverInfo: {
      name: "test-passthrough-with-local-tools",
      version: "1.0.0",
    },
    hooks: [localToolsHook],
  });

  // Keep the process alive
  process.on("SIGINT", async () => {
    await proxy.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await proxy.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start test server:", error);
  process.exit(1);
});
