#!/usr/bin/env tsx
/**
 * Test passthrough server with programmatic hooks
 *
 * This server demonstrates using programmatic hooks (Hook instances)
 * instead of remote HTTP hooks.
 */

import { createPassthroughProxy } from "@civic/passthrough-sdk";
import { CallCounterHook } from "@test/integration-hooks/CallCounterHook";
import { ReadSessionIdHook } from "@test/integration-hooks/ReadSessionIdHook";

async function main() {
  const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 34101;
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33100"; // Echo server

  console.log(`Starting programmatic passthrough server on port ${port}`);
  console.log(`Connecting to target: ${targetUrl}`);

  // Create hook instances
  const counterHook = new CallCounterHook();
  const sessionIdHook = new ReadSessionIdHook();

  // Create passthrough proxy with programmatic hooks
  const proxy = await createPassthroughProxy({
    transportType: "httpStream",
    port,
    target: {
      url: targetUrl,
      transportType: "httpStream",
    },
    hooks: [counterHook, sessionIdHook],
    serverInfo: {
      name: "programmatic-passthrough-test",
      version: "1.0.0",
    },
  });

  console.log(`Programmatic passthrough server is running on port ${port}`);
  console.log("Hooks configured:");
  console.log("  - CallCounterHook: Counts tool call requests");
  console.log("  - ReadSessionIdHook: Adds session ID to responses");

  // Keep the process running
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await proxy.stop();
    process.exit(0);
  });
}

main().catch(console.error);
