import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { StreamableHTTPClientTransport as PassthroughHTTPClientTransport } from "../client/streamableHttp.js";
import { StreamableHTTPServerTransport as PassthroughHTTPServerTransport } from "../server/streamableHttp.js";
import { PassthroughContext } from "../shared/passthroughContext.js";

describe("Passthrough Integration Tests", () => {
  let realMcpServer: McpServer;
  let realServerTransport: StreamableHTTPServerTransport;
  let realServer: Server;
  let realServerUrl: URL;

  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: PassthroughHTTPServerTransport;
  let passthroughClientTransport: PassthroughHTTPClientTransport;
  let passthroughServer: Server;
  let passthroughServerUrl: URL;

  let realClient: Client;
  let realClientTransport: StreamableHTTPClientTransport;

  beforeEach(async () => {
    // 1. Set up the REAL MCP Server
    realMcpServer = new McpServer(
      { name: "real-test-server", version: "1.0.0" },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    // Add a simple tool to the real server
    realMcpServer.tool(
      "greet",
      "A simple greeting tool",
      {
        name: z.string().describe("Name to greet").default("World"),
      },
      async ({ name }) => {
        return {
          content: [{ type: "text", text: `Hello, ${name}!` }],
        };
      },
    );

    // Set up real server transport and HTTP server
    realServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await realMcpServer.connect(realServerTransport);

    realServer = createServer();
    realServer.on("request", async (req, res) => {
      await realServerTransport.handleRequest(req, res);
    });

    realServerUrl = await new Promise<URL>((resolve) => {
      realServer.listen(0, "127.0.0.1", () => {
        const addr = realServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });

    // 2. Set up the PASSTHROUGH Context with Server and Client transports
    passthroughContext = new PassthroughContext();

    passthroughServerTransport = new PassthroughHTTPServerTransport({
      sessionIdGenerator: undefined, // Session is not generated from the Server Transport, but from the Client via PassthroughContext
    });

    passthroughClientTransport = new PassthroughHTTPClientTransport(
      realServerUrl,
    );

    await passthroughContext.connect(
      passthroughServerTransport,
      passthroughClientTransport,
    );

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

    // 3. Set up the CLIENT (connects to passthrough server)
    realClient = new Client({
      name: "integration-test-client",
      version: "1.0.0",
    });

    realClientTransport = new StreamableHTTPClientTransport(
      passthroughServerUrl,
    );
  });

  afterEach(async () => {
    // Clean up in reverse order
    try {
      await realClientTransport?.close();
    } catch (e) {
      console.warn("Error closing client transport:", e);
    }

    try {
      await passthroughContext?.close();
    } catch (e) {
      console.warn("Error closing passthrough context:", e);
    }

    passthroughServer?.close();

    try {
      await realMcpServer?.close();
    } catch (e) {
      console.warn("Error closing real MCP server:", e);
    }

    try {
      await realServerTransport?.close();
    } catch (e) {
      console.warn("Error closing real server transport:", e);
    }

    realServer?.close();
  });

  it("should successfully initialize through passthrough", async () => {
    // Connect the client to the passthrough server
    await realClient.connect(realClientTransport);

    // Verify that the client got connected and received server capabilities
    expect(realClientTransport.sessionId).toBeDefined();

    // The connection itself serves as a test of the initialization process
    // If we get here without throwing, initialization worked
    expect(realClient).toBeDefined();
  });

  it("should successfully list tools through passthrough", async () => {
    // Connect the client to the passthrough server
    await realClient.connect(realClientTransport);

    // List tools through the passthrough
    const toolsResult = await realClient.request(
      {
        method: "tools/list",
        params: {},
      },
      ListToolsResultSchema,
    );

    // Verify that we got the tools from the real server through the passthrough
    expect(toolsResult.tools).toBeDefined();
    expect(toolsResult.tools).toContainEqual(
      expect.objectContaining({
        name: "greet",
      }),
    );
  });

  it("should successfully call a tool through passthrough", async () => {
    // Connect the client to the passthrough server
    await realClient.connect(realClientTransport);

    // Call a tool through the passthrough
    const toolCallResult = await realClient.request(
      {
        method: "tools/call",
        params: {
          name: "greet",
          arguments: {
            name: "Passthrough Test",
          },
        },
      },
      z.any(), // We'll validate the structure manually since CallToolResultSchema might not be exported
    );

    // Verify that we got the expected response from the real server through the passthrough
    expect(toolCallResult).toBeDefined();
    expect(toolCallResult.content).toEqual([
      { type: "text", text: "Hello, Passthrough Test!" },
    ]);
  });
});
