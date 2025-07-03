import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEST_CONFIG } from "../test-config";
import { StdioTestClient } from "./sdk-client";

describe("Stdio Hooks Tests", () => {
  let client: StdioTestClient;

  beforeEach(async () => {
    client = new StdioTestClient();
  });

  afterEach(async () => {
    await client.close();
  });

  it("should add reason parameter via explain hook", async () => {
    // Connect with explain hook (running on port 33007)
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
      HOOKS: "http://localhost:33007",
    });

    const tools = await client.listTools();

    // Verify explain hook added reason parameter to all tools
    for (const tool of tools.tools) {
      expect(tool.inputSchema).toBeDefined();
      const schema = tool.inputSchema as any;
      expect(schema.properties?.reason).toBeDefined();
      expect(schema.properties.reason.type).toBe("string");
      expect(schema.properties.reason.description).toContain("justification");
      expect(schema.required).toContain("reason");
    }
  });

  it("should process tool calls with reason parameter", async () => {
    // Connect with explain hook
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
      HOOKS: "http://localhost:33007",
    });

    // Call echo tool with reason - hook should allow it through
    const result = (await client.callTool("echo", {
      message: "test with hooks",
      reason:
        "GOAL: Testing stdio hooks, JUSTIFICATION: Need to verify hooks work in stdio mode, CHOICE: Using echo as it's simple",
    })) as CallToolResult;

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Echo: test with hooks");
  });

  it("should handle missing reason parameter gracefully", async () => {
    // Connect with explain hook
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
      HOOKS: "http://localhost:33007",
    });

    // Try to call without reason - explain hook should handle this
    const shouldFail = client.callTool("echo", {
      message: "test without reason",
    });

    await expect(shouldFail).rejects.toThrow(
      "MCP error -32001: Missing or empty 'reason' parameter",
    );
  });
});
