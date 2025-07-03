import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEST_CONFIG } from "../test-config";
import { StdioTestClient } from "./sdk-client";

describe("Stdio Passthrough Basic Tests", () => {
  let client: StdioTestClient;

  beforeEach(async () => {
    client = new StdioTestClient();
  });

  afterEach(async () => {
    await client.close();
  });

  it("should list tools through stdio transport", async () => {
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    const toolResult = await client.listTools();

    expect(toolResult.tools).toHaveLength(3);
    expect(toolResult.tools.map((t) => t.name)).toContain("echo");
    expect(toolResult.tools.map((t) => t.name)).toContain("count");
    expect(toolResult.tools.map((t) => t.name)).toContain("trigger-ping");
  });

  it("should maintain session persistence across multiple requests", async () => {
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    // Make multiple echo calls
    for (let i = 1; i <= 3; i++) {
      const echoResult = (await client.callTool("echo", {
        message: `test ${i}`,
      })) as CallToolResult;
      expect(echoResult.content[0].text).toBe(`Echo: test ${i}`);
    }

    // Call count tool to verify it tracked all 3 echo calls
    // This proves the same session is being used (counter would be 0 with new session)
    const countResult = (await client.callTool("count")) as CallToolResult;
    expect(countResult.content[0].type).toBe("text");
    expect(countResult.content[0].text).toBe("Call count: 3");
  });

  it("should connect to different target servers", async () => {
    // Test with echo server
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    const echoToolResult = await client.listTools();
    expect(echoToolResult.tools).toHaveLength(3);

    await client.close();

    // Test with main target server
    client = new StdioTestClient();
    await client.connect({
      TARGET_SERVER_URL: TEST_CONFIG.targetServers.withoutAuth.url,
      TARGET_SERVER_MCP_PATH: "/stream",
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    const mainTools = await client.listTools();
    expect(mainTools.tools.length).toBeGreaterThan(0);
  });

  it("should handle rapid connect/disconnect cycles", async () => {
    for (let i = 0; i < 3; i++) {
      const tempClient = new StdioTestClient();

      await tempClient.connect({
        TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
        TARGET_SERVER_TRANSPORT: "httpStream",
      });

      const toolsResult = await tempClient.listTools();
      expect(toolsResult.tools).toHaveLength(3);

      await tempClient.close();
    }
  });

  it("should properly clean up on close", async () => {
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    // Verify connection works
    const toolsResult = await client.listTools();
    expect(toolsResult.tools).toBeDefined();

    // Close the connection
    await client.close();

    // Attempting to use after close should fail
    await expect(client.listTools()).rejects.toThrow("Not connected");
  });

  it("should call tools through stdio transport", async () => {
    // Connect to echo server via passthrough
    await client.connect({
      TARGET_SERVER_URL: `${TEST_CONFIG.targetServers.echo.url}`,
      TARGET_SERVER_TRANSPORT: "httpStream",
    });

    // Call the echo tool with test data
    const result = (await client.callTool("echo", {
      message: "Testing stdio tool calls",
    })) as CallToolResult;

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Echo: Testing stdio tool calls");
  });
});
