import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TokenAuthProvider } from "@civic/auth-mcp/client";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthenticatedClient,
  createTestClient,
  createUnauthenticatedClient,
} from "./test-client";
import { TEST_CONFIG } from "./test-config";

// Load test JWT token
const TEST_JWT = readFileSync(
  join(__dirname, "fixtures/jwt.txt"),
  "utf-8",
).trim();

describe("Authentication Flow Tests", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe("Passthrough with OAuth authentication", () => {
    it("should fail to connect without authentication", async () => {
      await expect(async () => {
        client = await createUnauthenticatedClient(
          TEST_CONFIG.passthroughServers.withAuth.url,
        );
      }).rejects.toThrow();
    });

    it("should connect with valid token", async () => {
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_JWT,
      );

      expect(client).toBeDefined();
      // Verify connection by listing tools
      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(tools.tools).toHaveLength(1);
      expect(tools.tools[0].name).toBe("whoami");
    });

    it("should pass through authorization headers to target server", async () => {
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_JWT,
      );

      // List tools to verify auth is working
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
      expect(tools.tools).toHaveLength(1);

      // Call the whoami tool to verify auth is passed through
      const result = (await client.callTool({
        name: "whoami",
        arguments: {},
      })) as any;

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBe("Hello test-user-123!");
    });

    it("should handle invalid tokens", async () => {
      const INVALID_TOKEN = "invalid-token";

      await expect(async () => {
        client = await createAuthenticatedClient(
          TEST_CONFIG.passthroughServers.withAuth.url,
          INVALID_TOKEN,
        );
      }).rejects.toThrow();
    });
  });

  describe("OAuth flow passthrough", () => {
    it("should handle OAuth-protected server connection attempt", async () => {
      // When connecting to an OAuth-protected server without auth,
      // the MCP client should receive appropriate error
      const shouldFail = createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
      );

      await expect(shouldFail).rejects.toThrow();
    });
  });

  describe("Token-based authentication", () => {
    it("should support custom auth providers", async () => {
      // Create a custom auth provider
      const customAuthProvider = new TokenAuthProvider("custom-token-xyz");

      const shouldFail = createTestClient({
        url: TEST_CONFIG.passthroughServers.withAuth.url,
        authProvider: customAuthProvider,
      });

      await expect(shouldFail).rejects.toThrow();
    });

    it("should work with TokenAuthProvider from civic auth", async () => {
      // Verify that TokenAuthProvider from @civic/auth-mcp works with valid token
      const authProvider = new TokenAuthProvider(TEST_JWT);

      client = await createTestClient({
        url: TEST_CONFIG.passthroughServers.withAuth.url,
        authProvider,
      });

      // Should successfully connect with valid token
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(1);
      expect(tools.tools[0].name).toBe("whoami");
    });
  });
});
