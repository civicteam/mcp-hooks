import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";
import { createUnauthenticatedClient } from "../test-client";
import { TEST_CONFIG } from "../test-config";

describe("Headers Hook Tests", () => {
  let directClient: Client | undefined;
  let proxiedClient: Client | undefined;

  afterEach(async () => {
    if (directClient) {
      await directClient.close();
      directClient = undefined;
    }
    if (proxiedClient) {
      await proxiedClient.close();
      proxiedClient = undefined;
    }
  });

  it("should fail to access protected server without API key", async () => {
    // Connect directly to the API key protected server
    const shouldFail= createUnauthenticatedClient(
      `${TEST_CONFIG.targetServers.apiKeyProtected.url}/mcp`
    );

    await expect(shouldFail).rejects.toThrow("Unauthorized");
  });

  it("should successfully access protected server through API key hook", async () => {
    // Connect through the passthrough server with API key hook
    proxiedClient = await createUnauthenticatedClient(
      TEST_CONFIG.passthroughServers.withApiKeyHook.url
    );

    // List tools - should work because the hook adds the API key
    const tools = await proxiedClient.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);
    
    // Find the protected-echo tool
    const protectedEcho = tools.tools.find((t) => t.name === "protected-echo");
    expect(protectedEcho).toBeDefined();
  });

  it("should execute protected tool through API key hook", async () => {
    // Connect through the passthrough server with API key hook
    proxiedClient = await createUnauthenticatedClient(
      TEST_CONFIG.passthroughServers.withApiKeyHook.url
    );

    // Call the protected echo tool
    const result = await proxiedClient.callTool({
      name: "protected-echo",
      arguments: {
        message: "Hello from test!",
      },
    });

    expect(result).toBeDefined();

    const textContent = (result.content as { type: "text"; text: string }[])[0];
    expect(textContent.text).toBe("Protected Echo: Hello from test!");
  });
});