import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";
import { createUnauthenticatedClient } from "../test-client";
import { TEST_CONFIG } from "../test-config";

describe("Hook Processing Tests", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe("Explain Hook Integration", () => {
    it("should add reason parameter to all tools", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withHooks.url,
      );

      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBeGreaterThan(0);

      // Check that all tools have the reason parameter
      for (const tool of tools.tools) {
        expect(tool.inputSchema).toBeDefined();
        const schema = tool.inputSchema as any;
        expect(schema.properties).toBeDefined();
        expect(schema.properties.reason).toBeDefined();
        expect(schema.properties.reason.type).toBe("string");
        expect(schema.properties.reason.description).toContain("justification");
        expect(schema.required).toContain("reason");
      }
    });

    it("should process tool calls with reason parameter", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withHooks.url,
      );

      // Call fetch tool with reason
      const result = await client.callTool({
        name: "fetch",
        arguments: {
          url: "https://docs.civic.com",
          reason:
            "GOAL: Testing hook functionality, JUSTIFICATION: Need to verify that the fetch tool works with the reason parameter, CHOICE: Using fetch because it's a simple tool to test with",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect((result.content as string).length).toBeGreaterThan(0);
    });

    it("should handle missing reason parameter gracefully", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withHooks.url,
      );

      // The explain hook makes reason required, so this should fail
      const callWithoutReason = client.callTool({
        name: "fetch",
        arguments: {
          url: "https://docs.civic.com",
        },
      });

      // Expect the call to be rejected due to missing required parameter
      await expect(callWithoutReason).rejects.toThrow();
    });

    it("should maintain session across hook-processed requests", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withHooks.url,
      );

      // First request
      const tools1 = await client.listTools();
      expect(tools1.tools).toBeDefined();

      // Tool call with reason
      await client.callTool({
        name: "fetch",
        arguments: {
          url: "https://example.com",
          reason:
            "GOAL: Session test, JUSTIFICATION: Testing session persistence, CHOICE: Simple test URL",
        },
      });

      // Second tools list to verify session
      const tools2 = await client.listTools();
      expect(tools2.tools).toEqual(tools1.tools);
    });
  });
});
