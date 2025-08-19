import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { RequestExtra } from "@civic/hook-common";
import { ServerHook } from "@civic/server-hook";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsResultSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PassthroughContext } from "../shared/passthroughContext.js";

describe("Passthrough Hook-Only Integration Tests", () => {
  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: StreamableHTTPServerTransport;
  let passthroughServer: Server;
  let passthroughServerUrl: URL;
  let client: Client;
  let clientTransport: StreamableHTTPClientTransport;
  let serverHook: ServerHook;
  let toolsHook: any;

  beforeEach(async () => {
    // Create a server hook that will handle initialization
    serverHook = new ServerHook({
      serverInfo: {
        name: "hook-test-server",
        version: "1.0.0",
      },
      options: {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
      oninitialized: () => {
        console.log("Server hook initialization completed");
      },
    });

    // Create a tools hook that responds to tools/list and tools/call
    toolsHook = {
      get name() {
        return "ToolsHook";
      },
      async processListToolsRequest(request: any, requestExtra: RequestExtra) {
        return {
          resultType: "respond",
          response: {
            tools: [
              {
                name: "greet",
                description: "Greet someone",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                },
              },
            ],
          },
        };
      },
      async processCallToolRequest(request: any, requestExtra: RequestExtra) {
        if (request.params.name === "greet") {
          return {
            resultType: "respond",
            response: {
              content: [
                {
                  type: "text",
                  text: `Hello from hooks, ${request.params.arguments?.name || "World"}!`,
                },
              ],
            },
          };
        }
        return {
          resultType: "continue",
          request,
        };
      },
      async processCallToolResult(
        response: any,
        originalRequest: any,
        requestExtra: RequestExtra,
      ) {
        // Just pass through the response for this test
        return {
          resultType: "continue",
          response,
        };
      },
    };

    // Create passthrough context with hooks (serverHook and toolsHook)
    passthroughContext = new PassthroughContext([serverHook, toolsHook]);

    // Set up server transport (but NO client transport)
    passthroughServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Connect only the server transport - no client transport
    await passthroughContext.connect(passthroughServerTransport, undefined);

    // Create HTTP server for the passthrough
    passthroughServer = createServer();
    passthroughServer.on("request", async (req, res) => {
      await passthroughServerTransport.handleRequest(req, res);
    });

    passthroughServerUrl = await new Promise<URL>((resolve) => {
      passthroughServer.listen(0, "127.0.0.1", () => {
        const addr = passthroughServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });

    // Set up a client to connect to the passthrough server
    client = new Client({
      name: "hook-test-client",
      version: "1.0.0",
    });

    clientTransport = new StreamableHTTPClientTransport(passthroughServerUrl);
  });

  afterEach(async () => {
    try {
      await clientTransport?.close();
    } catch (e) {
      console.warn("Error closing client transport:", e);
    }

    try {
      await passthroughContext?.close();
    } catch (e) {
      console.warn("Error closing passthrough context:", e);
    }

    passthroughServer?.close();
  });

  it("should successfully initialize through server-hook without HTTP client transport", async () => {
    // Connect the client - this should trigger initialization handled by the server hook
    await client.connect(clientTransport);

    // Verify that the client got connected and received server capabilities
    expect(clientTransport.sessionId).toBeDefined();

    // Verify that the server hook processed the initialization
    expect(serverHook.isInitialized).toBe(true);

    // Verify the server hook has client info
    const clientInfo = serverHook.getClientVersion();
    expect(clientInfo).toBeDefined();
    expect(clientInfo?.name).toBe("hook-test-client");
    expect(clientInfo?.version).toBe("1.0.0");

    // Verify the server hook has client capabilities
    const clientCapabilities = serverHook.getClientCapabilities();
    expect(clientCapabilities).toBeDefined();
  });

  it("should successfully list tools through hooks", async () => {
    // Connect the client first
    await client.connect(clientTransport);

    // List tools through the hooks
    const toolsResult = await client.request(
      {
        method: "tools/list",
        params: {},
      },
      ListToolsResultSchema,
    );

    // Verify that we got the tools from the hook
    expect(toolsResult.tools).toBeDefined();
    expect(toolsResult.tools).toHaveLength(1);
    expect(toolsResult.tools[0].name).toBe("greet");
  });

  it("should successfully call a tool through hooks", async () => {
    // Connect the client first
    await client.connect(clientTransport);

    // Call a tool through the hooks
    const toolCallResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "greet",
          arguments: {
            name: "Hooks Test",
          },
        },
      },
      z.any(),
    );

    // Verify that we got the expected response from the hook
    expect(toolCallResult).toBeDefined();
    expect(toolCallResult.content).toEqual([
      { type: "text", text: "Hello from hooks, Hooks Test!" },
    ]);
  });

  it("should return an error when hook chain doesn't respond to a request", async () => {
    // Connect the client first
    await client.connect(clientTransport);

    // Try to call a tool that doesn't exist - the hook won't respond to this
    await expect(
      client.request(
        {
          method: "tools/call",
          params: {
            name: "nonexistent-tool",
            arguments: {},
          },
        },
        z.any(),
      ),
    ).rejects.toThrow();
  });

  it("should track requests and responses by requestId using RequestExtra", async () => {
    // Create a map to track request/response pairs by requestId
    const requestResponsePairs = new Map<
      string | number,
      {
        request?: any;
        response?: any;
        requestExtra?: RequestExtra;
      }
    >();

    // Create a tracking hook that uses RequestExtra to correlate requests and responses
    const trackingHook = {
      get name() {
        return "RequestTrackingHook";
      },

      async processCallToolRequest(request: any, requestExtra: RequestExtra) {
        // Store the request with its requestId
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing request with ID: ${requestId}, sessionId: ${requestExtra.sessionId}`,
        );

        if (!requestResponsePairs.has(requestId)) {
          requestResponsePairs.set(requestId, {});
        }
        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.request = request;
          pair.requestExtra = requestExtra;
        }

        return {
          resultType: "continue",
          request,
        };
      },

      async processCallToolResult(
        response: any,
        originalRequest: any,
        requestExtra: RequestExtra,
      ) {
        // Match the response to its request using requestId
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing response for request ID: ${requestId}`,
        );

        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.response = response;
          console.log(
            `[TrackingHook] Successfully matched response to request ${requestId}`,
          );
        } else {
          console.log(
            `[TrackingHook] Warning: No matching request found for response ${requestId}`,
          );
        }

        return {
          resultType: "continue",
          response,
        };
      },

      async processInitializeRequest(request: any, requestExtra: RequestExtra) {
        // Track initialize requests
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing initialize request with ID: ${requestId}, sessionId: ${requestExtra.sessionId}`,
        );

        if (!requestResponsePairs.has(requestId)) {
          requestResponsePairs.set(requestId, {});
        }
        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.request = request;
          pair.requestExtra = requestExtra;
        }

        return {
          resultType: "continue",
          request,
        };
      },

      async processInitializeResult(
        response: any,
        originalRequest: any,
        requestExtra: RequestExtra,
      ) {
        // Track initialize responses
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing initialize response for request ID: ${requestId}`,
        );

        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.response = response;
          console.log(
            `[TrackingHook] Successfully matched initialize response to request ${requestId}`,
          );
        }

        return {
          resultType: "continue",
          response,
        };
      },

      async processListToolsRequest(request: any, requestExtra: RequestExtra) {
        // Track list tools requests too
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing list tools request with ID: ${requestId}`,
        );

        if (!requestResponsePairs.has(requestId)) {
          requestResponsePairs.set(requestId, {});
        }
        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.request = request;
          pair.requestExtra = requestExtra;
        }

        return {
          resultType: "continue",
          request,
        };
      },

      async processListToolsResult(
        response: any,
        originalRequest: any,
        requestExtra: RequestExtra,
      ) {
        // Track list tools responses
        const requestId = requestExtra.requestId;
        console.log(
          `[TrackingHook] Processing list tools response for request ID: ${requestId}`,
        );

        const pair = requestResponsePairs.get(requestId);
        if (pair) {
          pair.response = response;
        }

        return {
          resultType: "continue",
          response,
        };
      },
    };

    // Create a new passthrough context with tracking hook, server hook, and tools hook
    const contextWithTracking = new PassthroughContext([
      trackingHook,
      serverHook,
      toolsHook,
    ]);

    // Set up new server transport
    const trackingServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await contextWithTracking.connect(trackingServerTransport, undefined);

    // Create new HTTP server
    const trackingServer = createServer();
    trackingServer.on("request", async (req, res) => {
      await trackingServerTransport.handleRequest(req, res);
    });

    const trackingServerUrl = await new Promise<URL>((resolve) => {
      trackingServer.listen(0, "127.0.0.1", () => {
        const addr = trackingServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });

    // Create new client
    const trackingClient = new Client({
      name: "tracking-test-client",
      version: "1.0.0",
    });

    const trackingClientTransport = new StreamableHTTPClientTransport(
      trackingServerUrl,
    );

    try {
      // Connect the client
      await trackingClient.connect(trackingClientTransport);

      // Make multiple requests to test tracking
      const toolsResult = await trackingClient.request(
        {
          method: "tools/list",
          params: {},
        },
        ListToolsResultSchema,
      );

      const toolCallResult = await trackingClient.request(
        {
          method: "tools/call",
          params: {
            name: "greet",
            arguments: {
              name: "Request Tracking Test",
            },
          },
        },
        z.any(),
      );

      // Give a moment for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that we tracked at least 3 request/response pairs (init, list tools, call tool)
      expect(requestResponsePairs.size).toBeGreaterThanOrEqual(3);

      // Verify that each tracked request has a matching response
      let foundInitializePair = false;
      let foundCallToolPair = false;
      let foundListToolsPair = false;

      for (const [requestId, pair] of requestResponsePairs) {
        console.log(`Checking pair for requestId ${requestId}:`, {
          hasRequest: !!pair.request,
          hasResponse: !!pair.response,
          hasRequestExtra: !!pair.requestExtra,
          sessionId: pair.requestExtra?.sessionId,
          method: pair.request?.method,
        });

        // Each pair should have both request and response
        if (pair.request && pair.response) {
          // Check if this is an initialize request
          if (pair.request.method === "initialize") {
            foundInitializePair = true;
            // Verify the response has server info
            expect(pair.response.serverInfo).toBeDefined();
            console.log(
              `[Test] Found initialize pair with requestId: ${requestId}`,
            );
          }

          // Check if this is a tool call
          if (pair.request.method === "tools/call") {
            foundCallToolPair = true;
            // Verify the response matches what we expect
            expect(pair.response.content).toBeDefined();
            expect(pair.response.content[0].text).toContain("Hello from hooks");
            console.log(
              `[Test] Found tool call pair with requestId: ${requestId}`,
            );
          }

          // Check if this is a tools list
          if (pair.request.method === "tools/list") {
            foundListToolsPair = true;
            // Verify the response has tools
            expect(pair.response.tools).toBeDefined();
            expect(pair.response.tools).toHaveLength(1);
            console.log(
              `[Test] Found tools list pair with requestId: ${requestId}`,
            );
          }
        }

        // Verify RequestExtra contains expected fields
        if (pair.requestExtra) {
          expect(pair.requestExtra.requestId).toBeDefined();
          expect(pair.requestExtra.sessionId).toBeDefined();
        }
      }

      // Ensure we found all three types of pairs
      expect(foundInitializePair).toBe(true);
      expect(foundCallToolPair).toBe(true);
      expect(foundListToolsPair).toBe(true);

      console.log(
        `[Test] Successfully tracked ${requestResponsePairs.size} request/response pairs`,
      );

      // Verify that all pairs have consistent sessionIds
      const sessionIds = Array.from(requestResponsePairs.values())
        .map((pair) => pair.requestExtra?.sessionId)
        .filter(Boolean);

      if (sessionIds.length > 0) {
        const firstSessionId = sessionIds[0];
        const allSameSession = sessionIds.every((id) => id === firstSessionId);
        expect(allSameSession).toBe(true);
      }
    } finally {
      // Clean up
      await trackingClientTransport.close();
      await contextWithTracking.close();
      trackingServer.close();
    }
  });
});
