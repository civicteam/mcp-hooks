import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEST_CONFIG } from "../test-config";
import { StdioTestClient } from "./sdk-client";

describe("Stdio Ping Handling Tests", () => {
  let client: StdioTestClient;

  beforeEach(async () => {
    client = new StdioTestClient();
  });

  afterEach(async () => {
    await client.close();
  });

  it("should forward pings from target server to client", async () => {
    const pings: any[] = [];

    // Connect through passthrough server in stdio mode
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    // Set up request handler to capture pings
    client.setRequestHandler(PingRequestSchema, async (request) => {
      console.log("Stdio client received request:", request.method);
      if (request.method === "ping") {
        pings.push(request);
        return {}; // Respond to ping
      }
      throw new Error(`Unhandled request: ${request.method}`);
    });

    // Call the echo tool
    const result1 = (await client.callTool("echo", {
      message: "Hello through stdio passthrough",
    })) as CallToolResult;
    expect(result1.content[0].text).toBe(
      "Echo: Hello through stdio passthrough",
    );

    // No pings yet
    expect(pings).toHaveLength(0);

    // Trigger a ping through the passthrough
    const pingResult = (await client.callTool(
      "trigger-ping",
    )) as CallToolResult;
    expect(pingResult.content[0].text).toBe("Ping triggered");

    // Wait for the ping to be forwarded through passthrough
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify ping was received through passthrough
    expect(pings).toHaveLength(1);
    expect(pings[0].method).toBe("ping");

    // Make another tool call to verify session is still valid after ping
    const result2 = (await client.callTool("echo", {
      message: "Still working after ping",
    })) as CallToolResult;
    expect(result2.content[0].text).toBe("Echo: Still working after ping");
  });

  it("should handle pings with hooks enabled", async () => {
    const pings: any[] = [];

    // Connect with explain hook
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
      HOOKS: "http://localhost:33007",
    });

    client.setRequestHandler(PingRequestSchema, async (request) => {
      if (request.method === "ping") {
        pings.push(request);
        return {};
      }
      throw new Error(`Unhandled request: ${request.method}`);
    });

    // Trigger ping with reason parameter (required by explain hook)
    const pingResult = (await client.callTool("trigger-ping", {
      reason:
        "GOAL: Test pings with hooks, JUSTIFICATION: Verify stdio ping forwarding works with hooks enabled, CHOICE: Using trigger-ping to generate server-side ping",
    })) as CallToolResult;
    expect(pingResult.content[0].text).toBe("Ping triggered");

    // Wait for ping
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify ping was received
    expect(pings).toHaveLength(1);
    expect(pings[0].method).toBe("ping");
  });
});
