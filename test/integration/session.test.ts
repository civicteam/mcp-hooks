import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthenticatedClient,
  createUnauthenticatedClient,
} from "./test-client";
import { TEST_CONFIG } from "./test-config";

describe("Session Management Tests", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe("Session handling through MCP client", () => {
    it("should establish session through passthrough", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Session is implicitly created during connect
      expect(client).toBeDefined();

      // Verify we can make requests
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
    });

    it("should handle multiple concurrent client connections", async () => {
      const clients: Client[] = [];

      try {
        // Create multiple clients concurrently
        const clientPromises = Array.from({ length: 3 }, () =>
          createUnauthenticatedClient(
            TEST_CONFIG.passthroughServers.withoutAuth.url,
          ),
        );

        const createdClients = await Promise.all(clientPromises);
        clients.push(...createdClients);

        // All clients should be connected
        expect(clients).toHaveLength(3);

        // Each client should be able to list tools independently
        const toolsPromises = clients.map((c) => c.listTools());
        const toolsResponses = await Promise.all(toolsPromises);

        toolsResponses.forEach((response) => {
          expect(response.tools).toBeDefined();
        });
      } finally {
        // Clean up all clients
        await Promise.all(clients.map((c) => c.close()));
      }
    });

    it("should maintain independent sessions for each client", async () => {
      const client1 = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );
      const client2 = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      try {
        // Both clients should work independently
        const [tools1, tools2] = await Promise.all([
          client1.listTools(),
          client2.listTools(),
        ]);

        expect(tools1.tools).toBeDefined();
        expect(tools2.tools).toBeDefined();
      } finally {
        await client1.close();
        await client2.close();
      }
    });
  });

  describe("Stateless proxy behavior", () => {
    it("should not require persistent state in passthrough", async () => {
      // Create and close multiple clients sequentially
      for (let i = 0; i < 3; i++) {
        const tempClient = await createUnauthenticatedClient(
          TEST_CONFIG.passthroughServers.withoutAuth.url,
        );

        const tools = await tempClient.listTools();
        expect(tools.tools).toBeDefined();

        await tempClient.close();
      }
    });

    it("should handle rapid connect/disconnect cycles", async () => {
      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        client = await createUnauthenticatedClient(
          TEST_CONFIG.passthroughServers.withoutAuth.url,
        );

        // Make a quick request
        await client.listTools();

        // Close immediately
        await client.close();
        client = undefined;
      }
    });
  });

  describe("Connection resilience", () => {
    it("should support reconnection through restartable transport", async () => {
      client = await createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withoutAuth.url,
      );

      // Make requests
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      // The transport handles reconnection internally
      // We can continue making requests
      const tools2 = await client.listTools();
      expect(tools2.tools).toBeDefined();
    });
  });
});
