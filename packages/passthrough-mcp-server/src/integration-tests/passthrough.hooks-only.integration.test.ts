import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
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
      async processListToolsRequest(request: any) {
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
      async processCallToolRequest(request: any) {
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
      async processCallToolResult(response: any, originalRequest: any) {
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
});
