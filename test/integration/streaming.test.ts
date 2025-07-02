import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthenticatedClient,
  createUnauthenticatedClient,
} from "./test-client";
import { TEST_CONFIG } from "./test-config";

// Load test JWT token
const TEST_JWT = readFileSync(
  join(__dirname, "fixtures/jwt.txt"),
  "utf-8",
).trim();

describe("Session Persistence and Multiple Operations Tests", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe("Session persistence without auth", () => {
    it("should maintain session across multiple tool calls", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Initialize happens during connect, no need to call it again

      // First tool call
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBeGreaterThan(0);

      // Second tool call - should work without re-initialization
      const tools2 = await client.listTools();
      expect(tools2.tools).toBeDefined();
      expect(tools2.tools).toEqual(tools.tools);

      // Third tool call with actual tool execution
      const fetchTool = tools.tools.find((t) => t.name === "fetch");
      if (fetchTool) {
        const result = await client.callTool({
          name: "fetch",
          arguments: {
            url: "https://example.com",
          },
        });
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      }

      // Fourth call - list tools again to verify session still valid
      const tools3 = await client.listTools();
      expect(tools3.tools).toBeDefined();
    });

    it("should handle sequential tool calls without re-initialization", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Make multiple sequential tool calls
      for (let i = 0; i < 5; i++) {
        const tools = await client.listTools();
        expect(tools.tools).toBeDefined();

        // Also try calling a tool if available
        if (tools.tools.length > 0 && tools.tools[0]) {
          try {
            const result = await client.callTool({
              name: tools.tools[0].name,
              arguments: {},
            });
            expect(result).toBeDefined();
          } catch (error) {
            // Tool might require specific parameters, that's ok
            expect(error).toBeDefined();
          }
        }
      }
    });

    it("should handle parallel tool calls on same session", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Get available tools first
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThan(0);

      // Make parallel requests on the same session
      const promises = [
        client.listTools(),
        client.listTools(),
        client.listTools(),
      ];

      const results = await Promise.all(promises);

      // All should succeed with same results
      results.forEach((result) => {
        expect(result.tools).toBeDefined();
        expect(result.tools).toEqual(tools.tools);
      });
    });
  });

  describe("Session persistence with auth", () => {
    it("should maintain authenticated session across multiple calls", async () => {
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_JWT,
      );

      // Multiple operations on authenticated session
      const tools1 = await client.listTools();
      expect(tools1.tools).toBeDefined();

      const tools2 = await client.listTools();
      expect(tools2.tools).toBeDefined();

      // Session should still be valid
      const tools3 = await client.listTools();
      expect(tools3.tools).toBeDefined();
    });

    it("should not require re-authentication for each call", async () => {
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_JWT,
      );

      // Make many calls to verify auth token is reused
      const callCount = 10;
      for (let i = 0; i < callCount; i++) {
        const tools = await client.listTools();
        expect(tools.tools).toBeDefined();
      }
    });
  });

  describe("Session behavior verification", () => {
    it("should handle mixed operations in single session", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Mix of different operations
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      // Call the fetch tool directly
      const result = await client.callTool({
        name: "fetch",
        arguments: {
          url: "https://example.com",
        },
      });
      expect(result.content).toBeDefined();

      // List tools again
      const toolsAgain = await client.listTools();
      expect(toolsAgain.tools).toEqual(tools.tools);
    });

    it("should properly close sessions", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Use the session
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      // Close the session
      await client.close();

      // Should not be able to use after close
      const shouldFail = client.listTools();
      await expect(shouldFail).rejects.toThrow();

      // Clear reference for afterEach
      client = undefined;
    });

    it("should handle session across different tool types", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Get all available tools
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools;

      if (tools.length >= 2) {
        // Call different tools in sequence
        for (const tool of tools.slice(0, 2)) {
          try {
            await client.callTool({
              name: tool.name,
              arguments: {},
            });
          } catch (error) {
            // Tool might require parameters, but session should still be valid
            expect(error).toBeDefined();
          }
        }

        // Verify session still works
        const finalTools = await client.listTools();
        expect(finalTools.tools).toBeDefined();
      } else if (tools.length === 1) {
        // Call same tool multiple times
        const tool = tools[0];
        for (let i = 0; i < 3; i++) {
          try {
            await client.callTool({
              name: tool.name,
              arguments: {},
            });
          } catch (error) {
            expect(error).toBeDefined();
          }
        }
      }
    });
  });

  describe("Session error handling", () => {
    it("should maintain session after tool errors", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Cause an error by calling non-existent tool
      const shouldFail = client.callTool({
        name: "non-existent-tool",
        arguments: {},
      });
      await expect(shouldFail).rejects.toThrow();

      // Session should still be valid
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      // Can still call valid tools
      if (tools.tools.length > 0) {
        const tool = tools.tools[0];
        try {
          await client.callTool({
            name: tool.name,
            arguments: {},
          });
        } catch (error) {
          // Parameter errors are ok, session is still valid
          expect(error).toBeDefined();
        }
      }
    });

    it("should handle invalid parameters without breaking session", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      const tools = await client.listTools();
      const fetchTool = tools.tools.find((t) => t.name === "fetch");

      if (fetchTool) {
        // Call with invalid parameters
        const shouldFail = client.callTool({
          name: "fetch",
          arguments: { url: 123 },
        }); // Invalid URL type
        await expect(shouldFail).rejects.toThrow();

        // Session should still work
        const result = await client.callTool({
          name: "fetch",
          arguments: {
            url: "https://example.com",
          },
        });
        expect(result.content).toBeDefined();
      }
    });
  });
});
