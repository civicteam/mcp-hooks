import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  type InitializeResult,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  isJSONRPCRequest,
  isJSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import {
  InitializeResultSchema,
  InitializedNotificationSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PassthroughContext } from "../shared/passthroughContext.js";
import { StdioTestHelper } from "./helpers/StdioTestHelper.js";

describe("Passthrough Stdio-to-HTTP Integration Tests", () => {
  let realMcpServer: McpServer;
  let realServerTransport: StreamableHTTPServerTransport;
  let realServer: Server;
  let realServerUrl: URL;

  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: StdioServerTransport;
  let passthroughClientTransport: StreamableHTTPClientTransport;

  // Test helper for stdio communication
  let stdioHelper: StdioTestHelper;

  // Track if initialized notification was received
  let initializedReceived = false;

  // Helper function to initialize the MCP connection
  // Performs the complete MCP handshake: initialize request -> response -> initialized notification
  async function initializeMcpConnection(): Promise<InitializeResult> {
    const initRequest: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: stdioHelper.getNextMessageId(),
      method: "initialize",
      params: {
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0",
        },
      },
    };

    // Send and wait for response
    const response = await stdioHelper.sendAndWaitForResponse(initRequest);
    expect(response).toBeTruthy();
    expect(isJSONRPCResponse(response)).toBeTruthy();

    // Validate the result matches InitializeResultSchema
    const parseResult = InitializeResultSchema.safeParse(
      (response as JSONRPCResponse).result,
    );
    expect(parseResult.success).toBe(true);

    // Send initialized notification to complete the handshake
    const initializedNotification: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    };

    // Validate the notification params using the schema
    const parseNotificationParams =
      InitializedNotificationSchema.shape.params.safeParse(
        initializedNotification.params,
      );
    expect(parseNotificationParams.success).toBe(true);

    // Send the notification
    stdioHelper.sendMessage(initializedNotification);

    // Wait a moment for the notification to be processed
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Verify that the initialized notification was received by the server
    expect(initializedReceived).toBe(true);

    return parseResult.data;
  }

  beforeEach(async () => {
    // 1. Set up the REAL MCP Server
    realMcpServer = new McpServer(
      { name: "RealMCPServer", version: "1.0.0" },
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

    // Set up callback to track initialized notification
    realMcpServer.server.oninitialized = () => {
      initializedReceived = true;
    };

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

    // 2. Set up the PASSTHROUGH Context with Stdio Server and HTTP Client transports
    passthroughContext = new PassthroughContext();

    // Create stdio test helper
    stdioHelper = new StdioTestHelper();

    passthroughServerTransport = new StdioServerTransport(
      stdioHelper.getStdin(),
      stdioHelper.getStdout(),
    );

    passthroughClientTransport = new StreamableHTTPClientTransport(
      realServerUrl,
    );

    await passthroughContext.connect(
      passthroughServerTransport,
      passthroughClientTransport,
    );

    // 3. No client setup needed - we'll write directly to streams
  });

  afterEach(async () => {
    await passthroughContext?.close();
    await realMcpServer?.close();
    initializedReceived = false;
    await new Promise<void>((resolve) => {
      if (realServer) {
        realServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it("should successfully initialize through stdio-to-http passthrough", async () => {
    const initResponse = await initializeMcpConnection();
    expect(initResponse.serverInfo).toMatchObject({
      name: "RealMCPServer",
      version: "1.0.0",
    });
  });

  it("should successfully list tools through stdio-to-http passthrough", async () => {
    // First initialize
    await initializeMcpConnection();

    // Send tools/list request
    const toolsRequest: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: stdioHelper.getNextMessageId(),
      method: "tools/list",
      params: {},
    };

    // Send and wait for response
    const response = await stdioHelper.sendAndWaitForResponse(toolsRequest);
    expect(response).toBeTruthy();
    expect(isJSONRPCResponse(response)).toBeTruthy();

    // Validate the result matches ListToolsResultSchema
    const parseResult = ListToolsResultSchema.safeParse(
      (response as JSONRPCResponse).result,
    );
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      expect(parseResult.data.tools).toHaveLength(1);
      expect(parseResult.data.tools[0]).toMatchObject({
        description: "A simple greeting tool",
        name: "greet",
      });
    }
  });

  it("should successfully ping server through stdio-to-http passthrough", async () => {
    // First initialize
    await initializeMcpConnection();

    // Send ping request
    const pingRequest: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: stdioHelper.getNextMessageId(),
      method: "ping",
      params: {},
    };

    // Send and wait for response
    const response = await stdioHelper.sendAndWaitForResponse(pingRequest);
    expect(response).toBeTruthy();
    expect(isJSONRPCResponse(response)).toBeTruthy();

    // For a ping, the result should be an empty object {} (ignoring _meta)
    const { _meta, ...resultWithoutMeta } = (response as JSONRPCResponse)
      .result as any;
    expect(resultWithoutMeta).toEqual({});
  });

  it("should successfully call a tool through stdio-to-http passthrough", async () => {
    // First initialize
    await initializeMcpConnection();

    // Send tools/call request
    const toolCallRequest: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: stdioHelper.getNextMessageId(),
      method: "tools/call",
      params: {
        name: "greet",
        arguments: {
          name: "Claude",
        },
      },
    };

    // Send and wait for response
    const response = await stdioHelper.sendAndWaitForResponse(toolCallRequest);
    expect(response).toBeTruthy();
    expect(isJSONRPCResponse(response)).toBeTruthy();

    // Verify this is a response with the expected structure
    const jsonResponse = response as JSONRPCResponse;
    // Verify the tool call result
    expect(jsonResponse.result).toHaveProperty("content");
    expect((jsonResponse.result as any).content).toHaveLength(1);
    expect((jsonResponse.result as any).content[0]).toMatchObject({
      type: "text",
      text: "Hello, Claude!",
    });
  });

  it("should handle server-initiated ping through stdio-to-http passthrough", async () => {
    // First initialize
    await initializeMcpConnection();

    // Track when we receive a ping request from the server
    let serverPingId: string | number | null = null;

    // Start the server ping and wait for it to complete
    const serverPingPromise = realMcpServer.server.ping();

    // Wait for the ping request to be sent through the passthrough
    const pingMessage = await stdioHelper.waitForMessage();

    // The server ping should appear as a request (not response) in our stream
    expect(isJSONRPCRequest(pingMessage)).toBeTruthy();
    // Verify this is a request (should have method and id, but no result)
    expect(pingMessage).toHaveProperty("method", "ping");

    serverPingId = (pingMessage as JSONRPCRequest).id;

    // Respond to the ping with an empty result
    const pingResponse: JSONRPCMessage = {
      jsonrpc: "2.0",
      id: serverPingId,
      result: {},
    };

    // Send the ping response back through the passthrough
    stdioHelper.sendMessage(pingResponse);

    // Wait for the response to be processed
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify the server ping completed successfully (now includes metadata from passthrough processing)
    const pingResult = await serverPingPromise;
    expect(pingResult).toEqual(
      expect.objectContaining({
        _meta: expect.objectContaining({
          sessionId: expect.any(String),
          source: "passthrough-server",
          timestamp: expect.any(String),
        }),
      }),
    );

    // Verify we handled the server ping correctly
    expect(serverPingId).not.toBeNull();
    expect(typeof serverPingId === "number").toBeTruthy();
  });
});
