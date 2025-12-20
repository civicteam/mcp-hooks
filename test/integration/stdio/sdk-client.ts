import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  CallToolRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

const scriptPath = join(__dirname, "../../../packages/passthrough-mcp-server");

export type StdioTestServerType =
  | "DEFAULT"
  | "WITH_LOCAL_TOOLS"
  | "WITH_LOCAL_TOOLS_AND_OVERRIDE";
const commandArgs: Record<StdioTestServerType, string[]> = {
  DEFAULT: ["tsx", "src/cli.ts", "--stdio"],
  WITH_LOCAL_TOOLS: ["tsx", "stdio/test-server-with-local-tools.ts"],
  WITH_LOCAL_TOOLS_AND_OVERRIDE: [
    "tsx",
    "stdio/test-server-with-local-tools.ts",
    "echo",
  ],
};

/**
 * Test client for stdio-based MCP server communication using the official SDK
 */
export class StdioTestClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * Connect to the passthrough server via stdio
   * For DEFAULT type, also accepts environment variables directly
   */
  async connect(
    envOrType: StdioTestServerType | Record<string, string> = "DEFAULT",
    env: Record<string, string> = {},
  ): Promise<void> {
    // Handle both old connect(env) and new connect(type, env) signatures
    let type: StdioTestServerType;
    let environment: Record<string, string>;

    if (typeof envOrType === "string") {
      type = envOrType;
      environment = env;
    } else {
      type = "DEFAULT";
      environment = envOrType;
    }
    const args = commandArgs[type];

    // Determine the cwd based on the server type
    const cwd = type === "DEFAULT" ? scriptPath : __dirname;

    // Create transport specifying the server command
    this.transport = new StdioClientTransport({
      command: "npx",
      args: args,
      env: {
        ...environment,
        ...getDefaultEnvironment(), // ensure the PATH env var is set correctly
      },
      cwd,
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
