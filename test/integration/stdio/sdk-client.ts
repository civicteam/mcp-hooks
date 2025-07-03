import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  CallToolRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

const scriptPath = join(__dirname, "../../../packages/passthrough-mcp-server");

/**
 * Test client for stdio-based MCP server communication using the official SDK
 */
export class StdioTestClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * Connect to the passthrough server via stdio
   */
  async connect(env: Record<string, string> = {}): Promise<void> {
    // Create transport specifying the server command
    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/cli.ts", "--stdio"],
      env: {
        ...env,
        ...getDefaultEnvironment(), // ensure the PATH env var is set correctly
      },
      cwd: scriptPath,
    });

    // Initialize the client
    this.client = new Client(
      {
        name: "stdio-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Connect to the server
    await this.client.connect(this.transport);
  }

  /**
   * List available tools
   */
  async listTools(): Promise<ListToolsResult> {
    if (!this.client) {
      throw new Error("Not connected");
    }
    return this.client.listTools();
  }

  /**
   * Call a tool
   */
  async callTool(
    name: string,
    args: CallToolRequest["params"]["arguments"] = {},
  ) {
    if (!this.client) {
      throw new Error("Not connected");
    }
    return this.client.callTool({
      name,
      arguments: args,
    });
  }

  /**
   * Set a request handler for handling server-initiated requests (like pings)
   */
  setRequestHandler(
    schema: Parameters<Client["setRequestHandler"]>[0],
    handler: Parameters<Client["setRequestHandler"]>[1],
  ): void {
    if (!this.client) {
      throw new Error("Not connected");
    }
    this.client.setRequestHandler(schema, handler);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}
