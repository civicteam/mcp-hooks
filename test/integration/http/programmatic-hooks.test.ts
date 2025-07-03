import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import { createUnauthenticatedClient } from "../test-client";
import { TEST_CONFIG } from "../test-config";

describe("Programmatic Hooks", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  it("should count tool call requests through programmatic hook", async () => {
    client = await createUnauthenticatedClient(
      TEST_CONFIG.passthroughServers.programmatic.url,
    );

    // Make first call - should show count 1
    const result1 = (await client.callTool({
      name: "echo",
      arguments: { message: "call 1" },
    })) as CallToolResult;
    expect(result1.content[2].text).toBe("[Hook: Request count is 1]");

    // Make second call - should show count 2
    const result2 = (await client.callTool({
      name: "echo",
      arguments: { message: "call 2" },
    })) as CallToolResult;
    expect(result2.content[2].text).toBe("[Hook: Request count is 2]");

    // Make third call - should show count 3
    const result3 = (await client.callTool({
      name: "echo",
      arguments: { message: "call 3" },
    })) as CallToolResult;
    expect(result3.content[2].text).toBe("[Hook: Request count is 3]");
  });

  it("should receive session ID in metadata", async () => {
    client = await createUnauthenticatedClient(
      TEST_CONFIG.passthroughServers.programmatic.url,
    );

    // Make a call - should show session ID in response
    const result = (await client.callTool({
      name: "echo",
      arguments: { message: "test session" },
    })) as CallToolResult;

    // Response should contain:
    // 1. Original echo response
    // 3. Session ID message
    // 2. Hook count message
    expect(result.content).toHaveLength(3);
    // Session ID should be a UUID format
    const sessionIdText = result.content[1].text;
    expect(sessionIdText).toMatch(/^\[Hook: Session ID is [a-f0-9-]+\]$/);
  });
});
