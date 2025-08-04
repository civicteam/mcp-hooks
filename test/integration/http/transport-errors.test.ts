import * as http from "node:http";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createUnauthenticatedClient } from "../test-client";
import { TEST_CONFIG } from "../test-config";

describe("Transport Error Alert Hook", () => {
  let client: Client | undefined;
  let alertWebhookCalls: Array<{ url: string; body: any }> = [];
  let webhookServer: http.Server;

  // Use the passthrough server configured with alert hook in setup-test-servers.sh
  const PASSTHROUGH_WITH_ALERT_URL = "http://localhost:34300/mcp";

  beforeAll(async () => {
    // Start a simple webhook server to receive alerts on port 9999
    webhookServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          alertWebhookCalls.push({
            url: req.url || "",
            body: JSON.parse(body),
          });
        } catch (e) {
          // Not JSON, store as string
          alertWebhookCalls.push({ url: req.url || "", body });
        }
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((resolve) => {
      webhookServer.listen(9999, resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      webhookServer.close(() => resolve());
    });
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
    alertWebhookCalls = [];
  });

  // TODO: The new hook interface does not support this anymore.
  it.skip("should trigger alert hook when 5xx error occurs during initialization", async () => {
    // The broken server and passthrough with alert hook are already running
    // from setup-test-servers.sh
    let errorThrown = false;
    let errorMessage = "";

    try {
      client = await createUnauthenticatedClient(PASSTHROUGH_WITH_ALERT_URL);
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      // Expected error - the broken server returns 500 for all requests
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain("500");

    // Wait for webhook to be called
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify alert was triggered
    expect(alertWebhookCalls).toHaveLength(1);
    const alertCall = alertWebhookCalls[0];
    expect(alertCall.url).toBe("/webhook");
    expect(alertCall.body).toMatchObject({
      type: "initialize_error",
      error: {
        code: 500,
        message: expect.stringContaining("HTTP 500"),
        data: expect.any(String),
      },
      timestamp: expect.any(String),
    });
  });

  it("should not trigger alert for non-5xx errors", async () => {
    // Create a client that will trigger a 401 error (auth required)
    // Using the auth-protected server without credentials
    const authProtectedUrl = "http://localhost:34008/mcp";

    let errorThrown = false;
    try {
      client = await createUnauthenticatedClient(authProtectedUrl);
    } catch (error) {
      errorThrown = true;
      // Expected error - 401 unauthorized
    }
    expect(errorThrown).toBe(true);

    // Wait to ensure no webhook is called
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify no alert was triggered (401 is not a 5xx error)
    expect(alertWebhookCalls).toHaveLength(0);
  });
});
