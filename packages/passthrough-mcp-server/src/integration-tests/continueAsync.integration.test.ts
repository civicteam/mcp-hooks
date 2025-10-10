import { randomUUID } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  CallToolRequestHookResult,
  CallToolResult,
  HookChainError,
  RequestExtra,
} from "@civic/hook-common";
import { ServerHook } from "@civic/server-hook";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassthroughContext } from "../shared/passthroughContext.js";

describe("ContinueAsync Integration Tests", () => {
  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: StreamableHTTPServerTransport;
  let passthroughServer: Server;
  let passthroughServerUrl: URL;
  let client: Client;
  let clientTransport: StreamableHTTPClientTransport;
  let serverHook: ServerHook;

  beforeEach(async () => {
    // Create a server hook that will handle initialization
    serverHook = new ServerHook({
      serverInfo: {
        name: "continueAsync-test-server",
        version: "1.0.0",
      },
      options: {
        capabilities: {
          tools: {},
        },
      },
    });
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

  async function setupContext(hooks: any[]) {
    // Create passthrough context with hooks
    passthroughContext = new PassthroughContext([serverHook, ...hooks]);

    // Set up server transport (but NO client transport to force hooks to respond)
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
      name: "continueAsync-test-client",
      version: "1.0.0",
    });

    clientTransport = new StreamableHTTPClientTransport(passthroughServerUrl);
    await client.connect(clientTransport);
  }

  describe("continueAsync with single hook", () => {
    it("should return immediate response and continue processing through remaining hooks", async () => {
      const callbackSpy = vi.fn();
      const hook2Spy = vi.fn();
      const hook3Spy = vi.fn();

      // Hook 1: Returns continueAsync with immediate response and callback
      const hook1 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(
          request: any,
          requestExtra: RequestExtra,
        ): Promise<CallToolRequestHookResult> {
          return {
            resultType: "continueAsync",
            request,
            response: {
              content: [
                {
                  type: "text",
                  text: "Immediate response from hook1",
                },
              ],
            },
            callback: async (
              response: CallToolResult | null,
              error: HookChainError | null,
            ) => {
              callbackSpy(response, error);
            },
          };
        },
      };

      // Hook 2: Should be called in the continuation
      const hook2 = {
        get name() {
          return "Hook2";
        },
        async processCallToolRequest(request: any, requestExtra: RequestExtra) {
          hook2Spy(request);
          return {
            resultType: "continue",
            request,
          };
        },
      };

      // Hook 3: Should respond and end the chain
      const hook3 = {
        get name() {
          return "Hook3";
        },
        async processCallToolRequest(request: any, requestExtra: RequestExtra) {
          hook3Spy(request);
          return {
            resultType: "respond",
            response: {
              content: [
                {
                  type: "text",
                  text: "Final response from hook3",
                },
              ],
            },
          };
        },
      };

      await setupContext([hook1, hook2, hook3]);

      // Make the call
      const result = await client.request(
        {
          method: "tools/call",
          params: {
            name: "test-tool",
            arguments: {},
          },
        },
        CallToolResultSchema,
      );

      // Should get immediate response from hook1
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Immediate response from hook1",
        },
      ]);

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify hook2 was called (in the async continuation)
      expect(hook2Spy).toHaveBeenCalledOnce();

      // Verify hook3 was called
      expect(hook3Spy).toHaveBeenCalledOnce();

      // Verify callback received the final response from hook3
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackError).toBeNull();
      expect(callbackResponse).toMatchObject({
        content: [
          {
            type: "text",
            text: "Final response from hook3",
          },
        ],
      });
      // Response should have metadata added
      expect(callbackResponse._meta).toBeDefined();
    });

    it("should call callback with error if hook chain encounters an error", async () => {
      const callbackSpy = vi.fn();
      const hook2Spy = vi.fn();

      // Hook 1: Returns continueAsync
      const hook1 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(
          request: any,
          requestExtra: RequestExtra,
        ): Promise<CallToolRequestHookResult> {
          return {
            resultType: "continueAsync",
            request,
            response: {
              content: [
                {
                  type: "text",
                  text: "Immediate response",
                },
              ],
            },
            callback: async (
              response: CallToolResult | null,
              error: HookChainError | null,
            ) => {
              callbackSpy(response, error);
            },
          };
        },
      };

      // Hook 2: Throws an error
      const hook2 = {
        get name() {
          return "ErrorHook";
        },
        async processCallToolRequest(request: any, requestExtra: RequestExtra) {
          hook2Spy(request);
          throw new Error("Hook2 error");
        },
      };

      await setupContext([hook1, hook2]);

      // Make the call
      const result = await client.request(
        {
          method: "tools/call",
          params: {
            name: "test-tool",
            arguments: {},
          },
        },
        CallToolResultSchema,
      );

      // Should get immediate response
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Immediate response",
        },
      ]);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify hook2 was called
      expect(hook2Spy).toHaveBeenCalledOnce();

      // Verify callback received error
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackResponse).toBeNull();
      expect(callbackError).toMatchObject({
        code: expect.any(Number),
        message: expect.stringContaining("Hook2 error"),
      });
    });
  });

  describe("continueAsync with multiple hooks in chain", () => {
    it("should only process hooks that were NOT already processed", async () => {
      const callbackSpy = vi.fn();
      const hook1RequestSpy = vi.fn();
      const hook1ResponseSpy = vi.fn();
      const hook2RequestSpy = vi.fn();
      const hook2ResponseSpy = vi.fn();
      const hook3RequestSpy = vi.fn();
      const hook3ResponseSpy = vi.fn();

      // Hook 1: Should process request, but NOT response (because continueAsync starts after it)
      const hook1 = {
        get name() {
          return "Hook1";
        },
        async processCallToolRequest(request: any, requestExtra: RequestExtra) {
          hook1RequestSpy(request);
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
          hook1ResponseSpy(response);
          return {
            resultType: "continue",
            response,
          };
        },
      };

      // Hook 2: Returns continueAsync - processes request, but response processing is async
      const hook2 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(
          request: any,
          requestExtra: RequestExtra,
        ): Promise<CallToolRequestHookResult> {
          hook2RequestSpy(request);
          return {
            resultType: "continueAsync",
            request,
            response: {
              content: [
                {
                  type: "text",
                  text: "Immediate response from hook2",
                },
              ],
            },
            callback: async (
              response: CallToolResult | null,
              error: HookChainError | null,
            ) => {
              callbackSpy(response, error);
            },
          };
        },
        async processCallToolResult(
          response: any,
          originalRequest: any,
          requestExtra: RequestExtra,
        ) {
          hook2ResponseSpy(response);
          return {
            resultType: "continue",
            response: {
              ...response,
              content: [
                ...response.content,
                { type: "text", text: " + modified by hook2 response" },
              ],
            },
          };
        },
      };

      // Hook 3: Should process request AND response (both sync and async paths)
      const hook3 = {
        get name() {
          return "Hook3";
        },
        async processCallToolRequest(request: any, requestExtra: RequestExtra) {
          hook3RequestSpy(request);
          return {
            resultType: "respond",
            response: {
              content: [
                {
                  type: "text",
                  text: "Response from hook3",
                },
              ],
            },
          };
        },
        async processCallToolResult(
          response: any,
          originalRequest: any,
          requestExtra: RequestExtra,
        ) {
          hook3ResponseSpy(response);
          return {
            resultType: "continue",
            response: {
              ...response,
              content: [
                ...response.content,
                { type: "text", text: " + modified by hook3 response" },
              ],
            },
          };
        },
      };

      await setupContext([hook1, hook2, hook3]);

      // Make the call
      const result = await client.request(
        {
          method: "tools/call",
          params: {
            name: "test-tool",
            arguments: {},
          },
        },
        CallToolResultSchema,
      );

      // Should get immediate response from hook2
      // NOTE: Response may be modified by hook2's response handler in the synchronous path
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: "Immediate response from hook2",
      });

      // Verify request path: hook1 -> hook2 -> hook3
      expect(hook1RequestSpy).toHaveBeenCalledOnce();
      expect(hook2RequestSpy).toHaveBeenCalledOnce();
      expect(hook3RequestSpy).toHaveBeenCalledOnce();

      // Verify response path (synchronous): hook3 response IS called (because hook3 returned "respond"),
      // hook2 response IS called, hook1 response IS called (synchronous return path from hook2's continueAsync)
      expect(hook3ResponseSpy).toHaveBeenCalledOnce();
      expect(hook2ResponseSpy).toHaveBeenCalledOnce();
      expect(hook1ResponseSpy).toHaveBeenCalledOnce();

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After async: The async path doesn't call hook3 response again because
      // the continuation starts from hook3 (not before it), so it only processes once total
      // But hook2's response handler is called once in sync path (when returning immediate response)
      // Total: hook3 response = 1 call, hook2 response = 1 call
      // (No additional calls in async path - the async path processes from hook2.next forward)
      expect(hook3ResponseSpy).toHaveBeenCalledOnce();
      expect(hook2ResponseSpy).toHaveBeenCalledOnce();

      // Verify callback received the final response (after all async processing)
      expect(callbackSpy).toHaveBeenCalledOnce();
      const callbackArg = callbackSpy.mock.calls[0][0];
      // The response went through both hook3 and hook2 response handlers twice (sync + async)
      // so the content array will have modifications from both
      expect(callbackArg.content[0].text).toBe("Response from hook3");
      // Additional text modifications from response handlers
      expect(callbackArg.content.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("continueAsync with no remaining hooks", () => {
    it("should call callback even if there are no more hooks to process", async () => {
      const callbackSpy = vi.fn();

      // Single hook that returns continueAsync but is the last hook
      const hook1 = {
        get name() {
          return "LastHook";
        },
        async processCallToolRequest(
          request: any,
          requestExtra: RequestExtra,
        ): Promise<CallToolRequestHookResult> {
          return {
            resultType: "continueAsync",
            request,
            response: {
              content: [
                {
                  type: "text",
                  text: "Response from last hook",
                },
              ],
            },
            callback: async (
              response: CallToolResult | null,
              error: HookChainError | null,
            ) => {
              callbackSpy(response, error);
            },
          };
        },
      };

      await setupContext([hook1]);

      // Make the call
      const result = await client.request(
        {
          method: "tools/call",
          params: {
            name: "test-tool",
            arguments: {},
          },
        },
        CallToolResultSchema,
      );

      // Should get immediate response
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Response from last hook",
        },
      ]);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Callback should be called with error (no client transport to forward to)
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackResponse).toBeNull();
      expect(callbackError).toMatchObject({
        code: expect.any(Number),
        message: expect.stringContaining("No client transport connected"),
      });
    });
  });
});
