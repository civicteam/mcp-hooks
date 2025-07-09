import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEST_CONFIG } from "../test-config";
import { StdioTestClient } from "./sdk-client";

describe("Stdio Passthrough Local Tools", () => {
  let client: StdioTestClient;

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  describe("with local tools", () => {
    beforeEach(async () => {
      client = new StdioTestClient();
      await client.connect("WITH_LOCAL_TOOLS", {
        TARGET_SERVER_URL: TEST_CONFIG.targetServers.echo.url,
        TARGET_SERVER_TRANSPORT: "httpStream",
      });
    });

    it("should execute local tools", async () => {
      const result = await client.callTool("local-reverse", {
        text: "hello",
      }) as CallToolResult;

      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("olleh");
    });

    it("should still execute remote tools", async () => {
      const result = await client.callTool("echo", {
        message: "test",
      }) as CallToolResult;

      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Echo: test");
    });

    it("should list both local and remote tools", async () => {
      const tools = await client.listTools();

      // Should have local tools
      const localReverse = tools.tools.find((t) => t.name === "local-reverse");
      expect(localReverse).toBeDefined();
      expect(localReverse?.description).toBe("Reverses a string locally");

      const localError = tools.tools.find((t) => t.name === "local-error");
      expect(localError).toBeDefined();

      // Should still have remote tools
      const remoteTool = tools.tools.find((t) => t.name === "echo");
      expect(remoteTool).toBeDefined();
      expect(remoteTool?.description).toBe("Echoes back the input message");

      // Should have at least 5 tools (2 local + 3 remote)
      expect(tools.tools.length).toBeGreaterThanOrEqual(5);
    });

    it("should handle errors gracefully when local tool fails", async () => {
      // LocalToolsHook returns abort which becomes an error
      await expect(client.callTool("local-error", {})).rejects.toThrow("This tool always fails");
    });
  });

  describe("with local tool override", () => {
    beforeEach(async () => {
      client = new StdioTestClient();
      await client.connect("WITH_LOCAL_TOOLS_AND_OVERRIDE", {
        TARGET_SERVER_URL: TEST_CONFIG.targetServers.echo.url,
        TARGET_SERVER_TRANSPORT: "httpStream",
      });
    });

    it("should prioritize local tools over remote tools with same name", async () => {
      const result = await client.callTool("echo", {
        message: "test",
      }) as CallToolResult;

      // Should use the local echo tool that adds "LOCAL: " prefix
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("LOCAL: test");
    });
  });
});