import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  CallToolErrorHookResult,
  CallToolRequestHookResult,
  CallToolRequestWithContext,
  Hook,
  HookChainError,
  RequestExtra,
} from "@civic/hook-common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  type CallToolResult,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PassthroughContext } from "../shared/passthroughContext.js";

/**
 * Test hook for validating error callback behavior
 */
class ErrorTestHook implements Hook {
  private errorCallbackInvoked = false;
  private lastError: HookChainError | null = null;
  private errorMode: "passthrough" | "transform" | "recover" = "passthrough";

  get name(): string {
    return "ErrorTestHook";
  }

  setErrorMode(mode: "passthrough" | "transform" | "recover"): void {
    this.errorMode = mode;
    this.resetState();
  }

  resetState(): void {
    this.errorCallbackInvoked = false;
    this.lastError = null;
  }

  wasErrorCallbackInvoked(): boolean {
    return this.errorCallbackInvoked;
  }

  getLastError(): HookChainError | null {
    return this.lastError;
  }

  async processCallToolRequest(
    request: CallToolRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    // Trigger an error for specific tool names (for single hook tests)
    if (request.params.name === "trigger-error") {
      throw new McpError(-32001, "Test error from hook");
    }
    return {
      resultType: "continue",
      request,
    };
  }

  async processCallToolResult(
    response: any,
    originalRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<any> {
    // Default implementation - pass through
    return {
      resultType: "continue",
      response,
    };
  }

  async processCallToolError(
    error: HookChainError,
    originalRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult> {
    this.errorCallbackInvoked = true;
    this.lastError = error;

    switch (this.errorMode) {
      case "transform":
        // Transform the error to a different error
        throw new McpError(-32002, `Transformed: ${error.message}`);

      case "recover":
        // Recover from the error by providing a successful response
        return {
          resultType: "respond",
          response: {
            content: [
              {
                type: "text",
                text: `Recovered from error: ${error.message}`,
              },
            ],
          },
        };
      default:
        // Continue with the error unchanged
        return { resultType: "continue" };
    }
  }
}

describe("Error Callback Integration Tests", () => {
  let realMcpServer: McpServer;
  let realServerTransport: StreamableHTTPServerTransport;
  let realServer: Server;
  let realServerUrl: URL;

  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: StreamableHTTPServerTransport;
  let passthroughClientTransport: StreamableHTTPClientTransport;
  let passthroughServer: Server;
  let passthroughServerUrl: URL;

  let realClient: Client;
  let realClientTransport: StreamableHTTPClientTransport;

  let errorTestHook: ErrorTestHook;

  beforeEach(async () => {
    // 1. Set up the REAL MCP Server
    realMcpServer = new McpServer(
      { name: "test-server", version: "1.0.0" },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Add test tools to the real server
    realMcpServer.tool(
      "echo",
      "Echo a message",
      {
        message: z.string().describe("Message to echo"),
      },
      async ({ message }) => {
        return {
          content: [{ type: "text", text: `Echo: ${message}` }],
        };
      },
    );

    realMcpServer.tool(
      "trigger-error",
      "Tool that can trigger errors for testing",
      {
        message: z.string().describe("Message").optional(),
      },
      async ({ message }) => {
        // This tool will succeed at the server level
        // The error will be triggered by the hook
        return {
          content: [
            { type: "text", text: `Server response: ${message || "ok"}` },
          ],
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

    // 2. Set up the PASSTHROUGH Context with hooks
    errorTestHook = new ErrorTestHook();
    passthroughContext = new PassthroughContext([errorTestHook]);

    passthroughServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    passthroughClientTransport = new StreamableHTTPClientTransport(
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
      name: "test-client",
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

  describe("processCallToolError callback", () => {
    it("should invoke error callback when a hook throws an error", async () => {
      await realClient.connect(realClientTransport);

      // Reset hook state
      errorTestHook.resetState();
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(false);

      // Call a tool that will trigger an error in the hook
      const callPromise = realClient.callTool({
        name: "trigger-error",
        arguments: { message: "test" },
      });

      // Expect the call to fail with the hook's error
      await expect(callPromise).rejects.toThrow("Test error from hook");

      // Verify the error callback was invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);

      // Verify the error details were captured
      const lastError = errorTestHook.getLastError();
      expect(lastError).toBeDefined();
      expect(lastError?.code).toBe(-32001);
      expect(lastError?.message).toContain("Test error from hook");
    });

    it("should allow error callback to transform the error", async () => {
      await realClient.connect(realClientTransport);

      // Set hook to transform error mode
      errorTestHook.setErrorMode("transform");

      // Call a tool that will trigger an error
      const callPromise = realClient.callTool({
        name: "trigger-error",
        arguments: { message: "test" },
      });

      // The error should be transformed
      await expect(callPromise).rejects.toThrow("Transformed:");

      // Verify the error callback was invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);

      // Verify the original error was captured before transformation
      const lastError = errorTestHook.getLastError();
      expect(lastError?.code).toBe(-32001);
      expect(lastError?.message).toContain("Test error from hook");
    });

    it("should allow error callback to recover with a successful response", async () => {
      await realClient.connect(realClientTransport);

      // Set hook to recover mode
      errorTestHook.setErrorMode("recover");

      // Call a tool that will trigger an error
      const result = (await realClient.callTool({
        name: "trigger-error",
        arguments: { message: "test" },
      })) as CallToolResult;

      // The call should succeed with the recovery response
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toBe(
        "Recovered from error: MCP error -32001: Test error from hook",
      );

      // Verify the error callback was invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);
    });

    it("should pass through errors when error callback returns continue", async () => {
      await realClient.connect(realClientTransport);

      // Set hook to passthrough mode (default)
      errorTestHook.setErrorMode("passthrough");

      // Call a tool that will trigger an error
      const callPromise = realClient.callTool({
        name: "trigger-error",
        arguments: { message: "test" },
      });

      // The original error should pass through unchanged
      await expect(callPromise).rejects.toThrow("Test error from hook");

      // Verify the error callback was invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);
    });

    it("should handle successful tool calls without invoking error callback", async () => {
      await realClient.connect(realClientTransport);

      // Reset hook state
      errorTestHook.resetState();

      // Call a tool that will succeed
      const result = (await realClient.callTool({
        name: "echo",
        arguments: { message: "Hello World" },
      })) as CallToolResult;

      // The call should succeed
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect((result.content[0] as any).text).toBe("Echo: Hello World");

      // Error callback should NOT have been invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(false);
    });

    it("should handle server errors through error callbacks", async () => {
      await realClient.connect(realClientTransport);

      // Reset hook state
      errorTestHook.resetState();

      // Try to call a non-existent tool
      const callPromise = realClient.callTool({
        name: "non-existent-tool",
        arguments: { message: "test" },
      });

      // Should get an error from the server
      await expect(callPromise).rejects.toThrow();

      // The error callback should have been invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);

      // The error should be from the server
      const lastError = errorTestHook.getLastError();
      expect(lastError).toBeDefined();
      // The actual error code depends on the MCP server implementation
      // It could be -32601 (method not found) or -32602 (invalid params)
      expect(lastError?.code).toBeLessThan(0); // Just verify it's an error code
    });
  });

  describe("Multiple hooks with error callbacks", () => {
    it("should process error callbacks in reverse order", async () => {
      // Create additional test hooks
      const hook1 = new ErrorTestHook();
      const hook2 = new ErrorTestHook();
      const hook3 = new ErrorTestHook();

      // Configure hooks - error will come from calling a non-existent tool
      hook1.setErrorMode("passthrough");
      hook2.setErrorMode("transform"); // This will transform the error
      hook3.setErrorMode("passthrough");
      errorTestHook.setErrorMode("passthrough");

      // Recreate passthrough context with multiple hooks
      await passthroughContext.close();

      // Need to create new transports as the old ones are already started
      passthroughServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      passthroughClientTransport = new StreamableHTTPClientTransport(
        realServerUrl,
      );

      passthroughContext = new PassthroughContext([
        hook1,
        hook2,
        hook3,
        errorTestHook,
      ]);

      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );

      await realClient.connect(realClientTransport);

      // Call a non-existent tool to trigger an error from the server
      const callPromise = realClient.callTool({
        name: "non-existent-tool",
        arguments: { message: "test" },
      });

      // Should get the transformed error from hook2
      await expect(callPromise).rejects.toThrow("Transformed:");

      // Verify all error callbacks were invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);
      expect(hook1.wasErrorCallbackInvoked()).toBe(true);
      expect(hook2.wasErrorCallbackInvoked()).toBe(true);
      expect(hook3.wasErrorCallbackInvoked()).toBe(true);
    });

    it("should convert error to success when a hook recovers", async () => {
      // Create additional test hooks
      const hook1 = new ErrorTestHook();
      const hook2 = new ErrorTestHook();

      // Configure hooks - error will come from calling a non-existent tool
      hook1.setErrorMode("passthrough");
      hook2.setErrorMode("recover"); // This hook will recover
      errorTestHook.setErrorMode("passthrough");

      // Recreate passthrough context with multiple hooks
      await passthroughContext.close();

      // Need to create new transports as the old ones are already started
      passthroughServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      passthroughClientTransport = new StreamableHTTPClientTransport(
        realServerUrl,
      );

      passthroughContext = new PassthroughContext([
        hook1,
        hook2,
        errorTestHook,
      ]);

      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );

      await realClient.connect(realClientTransport);

      // Call a non-existent tool to trigger an error from the server
      const result = (await realClient.callTool({
        name: "non-existent-tool",
        arguments: { message: "test" },
      })) as CallToolResult;

      // Should get the recovery response from hook2
      expect(result).toBeDefined();
      expect((result.content[0] as any).text).toContain("Recovered from error");

      // Verify error callbacks were invoked
      // errorTestHook and hook2 should have their error callbacks invoked
      expect(errorTestHook.wasErrorCallbackInvoked()).toBe(true);
      expect(hook2.wasErrorCallbackInvoked()).toBe(true);
      // hook1 should NOT have its error callback invoked because hook2 recovered
      // from the error, so hook1 sees a successful response, not an error
      expect(hook1.wasErrorCallbackInvoked()).toBe(false);
    });
  });
});
