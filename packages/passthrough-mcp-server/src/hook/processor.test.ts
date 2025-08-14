import type {
  CallToolRequestHookResult,
  CallToolRequestWithContext,
  CallToolResponseHookResult,
  Hook,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types";
import { describe, expect, it, vi } from "vitest";
import { HookChain } from "./hookChain.js";
import {
  processNotificationThroughHooks,
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "./processor.js";

// Helper to create a tool call request
const createToolCall = (
  params: CallToolRequest["params"],
): CallToolRequest => ({
  params,
  method: "tools/call",
});

// Helper to create a tools list request
const createToolsList = (
  params: ListToolsRequest["params"] = {},
): ListToolsRequest => ({
  params,
  method: "tools/list",
});

// Helper to create a tool response
const createToolResponse = (
  result: Partial<CallToolResult>,
): CallToolResult => ({
  content: result.content || [],
  ...result,
});

// Helper to create a mock hook that properly implements the Hook interface
class MockHook implements Hook {
  constructor(private _name: string) {}

  get name(): string {
    return this._name;
  }

  // Default implementations that satisfy the interface
  async processCallToolRequest(
    request: CallToolRequestWithContext,
  ): Promise<CallToolRequestHookResult> {
    return { resultType: "continue", request };
  }

  async processCallToolResult(
    response: CallToolResult,
    originalRequest: CallToolRequestWithContext,
  ): Promise<CallToolResponseHookResult> {
    return { resultType: "continue", response };
  }
}

describe("Hook Processor", () => {
  describe("processRequestThroughHooks", () => {
    describe("with CallToolRequest", () => {
      it("should process request through empty hook chain", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, null, "processCallToolRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook).toBe(null);
        if (result.resultType === "continue") {
          expect(result.request).toEqual(toolCall);
        }
      });

      it("should process request through single approving hook", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const mockHook = new MockHook("test-hook");
        mockHook.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies CallToolRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processCallToolRequest).toHaveBeenCalledWith(toolCall);
      });

      it("should handle hook rejection", async () => {
        const toolCall = createToolCall({
          name: "delete",
          arguments: { path: "/important" },
        });

        const mockHook = new MockHook("security-hook");
        mockHook.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Destructive operation",
        } satisfies CallToolRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedHook?.name).toBe("security-hook");
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Destructive operation");
        }
      });

      it("should stop processing on first rejection", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies CallToolRequestHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        } satisfies CallToolRequestHookResult);

        const hook3 = new MockHook("hook3");
        hook3.processCallToolRequest = vi.fn();

        const chain = new HookChain([hook1, hook2, hook3]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedHook?.name).toBe("hook2");
        expect(hook1.processCallToolRequest).toHaveBeenCalled();
        expect(hook2.processCallToolRequest).toHaveBeenCalled();
        expect(hook3.processCallToolRequest).not.toHaveBeenCalled();
      });

      it("should allow hooks to modify request", async () => {
        const originalCallToolRequest = createToolCall({
          name: "fetch",
          arguments: { url: "http://example.com" },
        });

        const modifiedToolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" }, // Changed to HTTPS
        });

        const mockHook = new MockHook("modifier-hook");
        mockHook.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: modifiedToolCall,
        } satisfies CallToolRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(originalCallToolRequest, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.request).toEqual(modifiedToolCall);
        }
      });

      it("should skip hooks that don't implement the method", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const hook1 = new MockHook("hook1");
        // Delete the method to simulate a hook that doesn't implement it
        (hook1 as any).processCallToolRequest = undefined;

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies CallToolRequestHookResult);

        const chain = new HookChain([hook1, hook2]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(result.lastProcessedHook?.name).toBe("hook2");
        expect(hook2.processCallToolRequest).toHaveBeenCalled();
      });

      it("should handle direct response from hook", async () => {
        const toolCall = createToolCall({
          name: "echo",
          arguments: { message: "Hello" },
        });

        const mockResponse: CallToolResult = {
          content: [{ type: "text", text: "Hello" }],
        };

        const mockHook = new MockHook("cache-hook");
        mockHook.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: mockResponse,
        } as CallToolRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("respond");
        expect(result.lastProcessedHook?.name).toBe("cache-hook");
        if (result.resultType === "respond") {
          expect(result.response).toEqual(mockResponse);
        }
      });

      it("should handle direct response from middle hook and only process earlier hooks for response", async () => {
        const toolCall = createToolCall({
          name: "test",
          arguments: { value: "test" },
        });

        const directResponse: CallToolResult = {
          content: [{ type: "text", text: "Direct response from hook 2" }],
        };

        const modifiedResponse: CallToolResult = {
          content: [{ type: "text", text: "Modified by hook 1" }],
        };

        const requestCallOrder: string[] = [];
        const responseCallOrder: string[] = [];

        const hook1 = new MockHook("hook1");
        hook1.processCallToolRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook1-request");
          return {
            resultType: "continue",
            request: toolCall,
          } satisfies CallToolRequestHookResult;
        });
        hook1.processCallToolResult = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook1-response");
          return {
            resultType: "continue",
            response: modifiedResponse,
          } satisfies CallToolResponseHookResult;
        });

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook2-request");
          return {
            resultType: "respond",
            response: directResponse,
          } satisfies CallToolRequestHookResult;
        });
        hook2.processCallToolResult = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook2-response");
          return {
            resultType: "continue",
            response: directResponse,
          } satisfies CallToolResponseHookResult;
        });

        const hook3 = new MockHook("hook3");
        hook3.processCallToolRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook3-request");
          return {
            resultType: "continue",
            request: toolCall,
          } satisfies CallToolRequestHookResult;
        });
        hook3.processCallToolResult = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook3-response");
          return {
            resultType: "continue",
            response: directResponse,
          } satisfies CallToolResponseHookResult;
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        // Process request - should stop at hook2
        const requestResult = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, chain.head, "processCallToolRequest");

        expect(requestResult.resultType).toBe("respond");
        expect(requestResult.lastProcessedHook?.name).toBe("hook2");
        expect(requestCallOrder).toEqual(["hook1-request", "hook2-request"]);
        expect(hook3.processCallToolRequest).not.toHaveBeenCalled();

        // Process response - should only process hooks that saw the request (hook2 and hook1)
        const responseResult = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(
          directResponse,
          toolCall,
          requestResult.lastProcessedHook,
          "processCallToolResult",
        );

        // Verify only hook2 and hook1 processed the response (in reverse order)
        expect(responseCallOrder).toEqual(["hook2-response", "hook1-response"]);
        expect(hook3.processCallToolResult).not.toHaveBeenCalled();

        // Verify hook1 was able to modify the response
        expect(responseResult.resultType).toBe("continue");
        if (responseResult.resultType === "continue") {
          expect(responseResult.response).toEqual(modifiedResponse);
        }
      });
    });

    describe("with ListToolsRequest", () => {
      it("should process tools list request through hooks", async () => {
        const request = createToolsList();

        // Create a hook that supports tools list
        class ToolsListHook extends MockHook {
          async processListToolsRequest(
            request: ListToolsRequest,
          ): Promise<ListToolsRequestHookResult> {
            return { resultType: "continue", request };
          }
        }

        const mockHook = new ToolsListHook("test-hook");
        mockHook.processListToolsRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request,
        } satisfies ListToolsRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processListToolsRequest"
        >(request, chain.head, "processListToolsRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processListToolsRequest).toHaveBeenCalledWith(request);
      });
    });
  });

  describe("processResponseThroughHooks", () => {
    describe("with CallToolResult", () => {
      it("should process response through empty hook chain", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "test response" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, toolCall, null, "processCallToolResult");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook).toBe(null);
        if (result.resultType === "continue") {
          expect(result.response).toEqual(response);
        }
      });

      it("should process response through hooks in reverse order", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "test response" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });
        const callOrder: string[] = [];

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockImplementation(async () => {
          callOrder.push("hook1");
          return {
            resultType: "continue",
            response,
          } satisfies CallToolResponseHookResult;
        });

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn().mockImplementation(async () => {
          callOrder.push("hook2");
          return {
            resultType: "continue",
            response,
          } satisfies CallToolResponseHookResult;
        });

        const hook3 = new MockHook("hook3");
        hook3.processCallToolResult = vi.fn().mockImplementation(async () => {
          callOrder.push("hook3");
          return {
            resultType: "continue",
            response,
          } satisfies CallToolResponseHookResult;
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, toolCall, chain.tail, "processCallToolResult");

        expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
      });

      it("should handle response rejection", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "sensitive data" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const mockHook = new MockHook("filter-hook");
        mockHook.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Sensitive content",
        } satisfies CallToolResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, toolCall, chain.head, "processCallToolResult");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedHook?.name).toBe("filter-hook");
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Sensitive content");
        }
      });

      it("should allow hooks to modify response", async () => {
        const originalResponse: CallToolResult = {
          content: [{ type: "text", text: "original" }],
        };
        const modifiedResponse: CallToolResult = {
          content: [{ type: "text", text: "modified" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const mockHook = new MockHook("modifier-hook");
        mockHook.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: modifiedResponse,
        } satisfies CallToolResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(originalResponse, toolCall, chain.head, "processCallToolResult");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("modifier-hook");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(modifiedResponse);
        }
      });
    });

    describe("with ListToolsResult", () => {
      it("should process tools list response through hooks", async () => {
        const response: ListToolsResult = {
          tools: [{ name: "test-tool", description: "A test tool" }],
        };
        const request = createToolsList();

        // Create a hook that supports tools list
        class ToolsListHook extends MockHook {
          async processListToolsResult(
            response: ListToolsResult,
            originalRequest: ListToolsRequest,
          ): Promise<ListToolsResponseHookResult> {
            return { resultType: "continue", response };
          }
        }

        const mockHook = new ToolsListHook("test-hook");
        mockHook.processListToolsResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response,
        } satisfies ListToolsResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processListToolsResult"
        >(response, request, chain.head, "processListToolsResult");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processListToolsResult).toHaveBeenCalledWith(
          response,
          request,
        );
      });
    });
  });

  describe("complete flow scenarios", () => {
    it("should handle complete empty chain flow (request -> response)", async () => {
      const toolCall = createToolCall({ name: "fetch", arguments: {} });
      const response: CallToolResult = {
        content: [{ type: "text", text: "response" }],
      };

      // Process request through empty chain
      const requestResult = await processRequestThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processCallToolRequest"
      >(toolCall, null, "processCallToolRequest");

      expect(requestResult.resultType).toBe("continue");
      expect(requestResult.lastProcessedHook).toBe(null);
      if (requestResult.resultType === "continue") {
        expect(requestResult.request).toEqual(toolCall);
      }

      // Process response using the null lastProcessedHook
      const responseResult = await processResponseThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processCallToolResult"
      >(
        response,
        toolCall,
        requestResult.lastProcessedHook,
        "processCallToolResult",
      );

      expect(responseResult.resultType).toBe("continue");
      expect(responseResult.lastProcessedHook).toBe(null);
      if (responseResult.resultType === "continue") {
        expect(responseResult.response).toEqual(response);
      }
    });
  });

  describe("processRequestThroughHooks with reverse direction", () => {
    describe("with CallToolRequest", () => {
      it("should process request through hooks in reverse order", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolRequest = vi.fn().mockImplementation(
          (req) =>
            ({
              resultType: "continue",
              request: {
                ...req,
                params: { ...req.params, hook1: true },
              },
            }) satisfies CallToolRequestHookResult,
        );

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockImplementation(
          (req) =>
            ({
              resultType: "continue",
              request: {
                ...req,
                params: { ...req.params, hook2: true },
              },
            }) satisfies CallToolRequestHookResult,
        );

        const chain = new HookChain([hook1, hook2]);

        // Process in reverse (start from tail)
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(request, chain.tail, "processCallToolRequest", "reverse");

        expect(result.resultType).toBe("continue");

        // hook2 should be called first (reverse order)
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(request);
        expect(hook1.processCallToolRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({ hook2: true }),
          }),
        );

        // Final request should have both modifications
        if (result.resultType === "continue") {
          expect(result.request.params).toHaveProperty("hook1", true);
          expect(result.request.params).toHaveProperty("hook2", true);
        }
      });

      it("should handle single hook in reverse direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });

        const mockHook = new MockHook("test-hook");
        mockHook.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: {
            ...request,
            params: { ...request.params, modified: true },
          },
        } satisfies CallToolRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(request, chain.tail, "processCallToolRequest", "reverse");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processCallToolRequest).toHaveBeenCalledWith(request);
        if (result.resultType === "continue") {
          expect(result.request.params).toHaveProperty("modified", true);
        }
      });

      it("should handle abort in reverse direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request,
        });

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        });

        const chain = new HookChain([hook1, hook2]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(request, chain.tail, "processCallToolRequest", "reverse");

        expect(result.resultType).toBe("abort");
        // hook2 should be called first and abort
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(request);
        // hook1 should not be called due to abort
        expect(hook1.processCallToolRequest).not.toHaveBeenCalled();
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Blocked by hook2");
        }
      });

      it("should handle respond in reverse direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const mockResponse = { content: [{ type: "text", text: "cached" }] };

        const hook1 = new MockHook("hook1");
        hook1.processCallToolRequest = vi.fn();

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: mockResponse,
        });

        const chain = new HookChain([hook1, hook2]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(request, chain.tail, "processCallToolRequest", "reverse");

        expect(result.resultType).toBe("respond");
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(request);
        expect(hook1.processCallToolRequest).not.toHaveBeenCalled();
        if (result.resultType === "respond") {
          expect(result.response).toEqual(mockResponse);
        }
      });

      it("should skip hooks that don't implement method in reverse direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });

        const hook1 = new MockHook("hook1");
        // Don't implement processCallToolRequest

        const hook2 = new MockHook("hook2");
        hook2.processCallToolRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: {
            ...request,
            params: { ...request.params, hook2: true },
          },
        });

        const chain = new HookChain([hook1, hook2]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(request, chain.tail, "processCallToolRequest", "reverse");

        expect(result.resultType).toBe("continue");
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(request);
        if (result.resultType === "continue") {
          expect(result.request.params).toHaveProperty("hook2", true);
        }
      });
    });
  });

  describe("processResponseThroughHooks with forward direction", () => {
    describe("with CallToolResponse", () => {
      it("should process response through hooks in forward order", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockImplementation(
          (resp) =>
            ({
              resultType: "continue",
              response: {
                ...resp,
                content: [{ type: "text", text: "modified-by-hook1" }],
              },
            }) satisfies CallToolResponseHookResult,
        );

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn().mockImplementation(
          (resp) =>
            ({
              resultType: "continue",
              response: {
                ...resp,
                content: [{ type: "text", text: "modified-by-hook2" }],
              },
            }) satisfies CallToolResponseHookResult,
        );

        const chain = new HookChain([hook1, hook2]);

        // Process in forward direction (start from head)
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, request, chain.head, "processCallToolResult", "forward");

        expect(result.resultType).toBe("continue");

        // hook1 should be called first (forward order)
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
        );
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          expect.objectContaining({
            content: [{ type: "text", text: "modified-by-hook1" }],
          }),
          request,
        );

        // Final response should have hook2's modification
        if (result.resultType === "continue") {
          expect(result.response.content).toEqual([
            { type: "text", text: "modified-by-hook2" },
          ]);
        }
      });

      it("should handle single hook in forward direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const mockHook = new MockHook("test-hook");
        mockHook.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: {
            ...response,
            content: [{ type: "text", text: "modified" }],
          },
        } satisfies CallToolResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, request, chain.head, "processCallToolResult", "forward");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
        );
        if (result.resultType === "continue") {
          expect(result.response.content).toEqual([
            { type: "text", text: "modified" },
          ]);
        }
      });

      it("should handle abort in forward direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Response blocked by hook1",
        });

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn();

        const chain = new HookChain([hook1, hook2]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, request, chain.head, "processCallToolResult", "forward");

        expect(result.resultType).toBe("abort");
        // hook1 should be called first and abort
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
        );
        // hook2 should not be called due to abort
        expect(hook2.processCallToolResult).not.toHaveBeenCalled();
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Response blocked by hook1");
        }
      });

      it("should skip hooks that don't implement method in forward direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const hook1 = new MockHook("hook1");
        // Don't implement processCallToolResult

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: {
            ...response,
            content: [{ type: "text", text: "modified-by-hook2" }],
          },
        });

        const chain = new HookChain([hook1, hook2]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, request, chain.head, "processCallToolResult", "forward");

        expect(result.resultType).toBe("continue");
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
        );
        if (result.resultType === "continue") {
          expect(result.response.content).toEqual([
            { type: "text", text: "modified-by-hook2" },
          ]);
        }
      });

      it("should process empty chain in forward direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(response, request, null, "processCallToolResult", "forward");

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(response);
          expect(result.lastProcessedHook).toBe(null);
        }
      });

      it("should start from specified hook in forward direction", async () => {
        const request = createToolCall({ name: "fetch", arguments: {} });
        const response = createToolResponse({
          content: [{ type: "text", text: "original" }],
        });

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn();

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: {
            ...response,
            content: [{ type: "text", text: "modified-by-hook2" }],
          },
        });

        const hook3 = new MockHook("hook3");
        hook3.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: {
            ...response,
            content: [{ type: "text", text: "modified-by-hook3" }],
          },
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        // Start from hook2 (middle of chain) in forward direction
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult"
        >(
          response,
          request,
          chain.head?.next,
          "processCallToolResult",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        // hook1 should not be called (we started from hook2)
        expect(hook1.processCallToolResult).not.toHaveBeenCalled();
        // hook2 and hook3 should be called
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
        );
        expect(hook3.processCallToolResult).toHaveBeenCalled();
        if (result.resultType === "continue") {
          expect(result.response.content).toEqual([
            { type: "text", text: "modified-by-hook3" },
          ]);
        }
      });
    });

    describe("with different response types", () => {
      it("should handle ListToolsResponse in forward direction", async () => {
        const request: ListToolsRequest = { method: "tools/list", params: {} };
        const response: ListToolsResult = {
          tools: [{ name: "tool1", description: "Test tool" }],
        };

        const hook = new MockHook("tools-hook");
        hook.processListToolsResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: {
            tools: [
              { name: "tool1", description: "Test tool" },
              { name: "tool2", description: "Added by hook" },
            ],
          },
        } satisfies ListToolsResponseHookResult);

        const chain = new HookChain([hook]);
        const result = await processResponseThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processListToolsResult"
        >(response, request, chain.head, "processListToolsResult", "forward");

        expect(result.resultType).toBe("continue");
        expect(hook.processListToolsResult).toHaveBeenCalledWith(
          response,
          request,
        );
        if (result.resultType === "continue") {
          expect(result.response.tools).toHaveLength(2);
          expect(result.response.tools[1]).toEqual({
            name: "tool2",
            description: "Added by hook",
          });
        }
      });
    });
  });

  describe("processNotificationThroughHooks", () => {
    it("should process notification through empty hook chain", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const result = await processNotificationThroughHooks(
        notification,
        null,
        "processNotification",
      );

      expect(result.resultType).toBe("continue");
      expect(result.notification).toEqual(notification);
    });

    it("should process notification through single hook", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const mockHook = new MockHook("notification-hook");
      mockHook.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, modified: true },
        },
      });

      const chain = new HookChain([mockHook]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("continue");
      expect(mockHook.processNotification).toHaveBeenCalledWith(notification);
      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("modified", true);
      }
    });

    it("should handle notification abort by hook", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const mockHook = new MockHook("blocking-hook");
      mockHook.processNotification = vi.fn().mockResolvedValue({
        resultType: "abort",
        reason: "Notification blocked for security reasons",
      });

      const chain = new HookChain([mockHook]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("abort");
      if (result.resultType === "abort") {
        expect(result.reason).toBe("Notification blocked for security reasons");
      }
    });

    it("should process notification through multiple hooks", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, hook1: true },
        },
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, hook1: true, hook2: true },
        },
      });

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("continue");
      expect(hook1.processNotification).toHaveBeenCalled();
      expect(hook2.processNotification).toHaveBeenCalled();
      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("hook1", true);
        expect(result.notification.params).toHaveProperty("hook2", true);
      }
    });

    it("should stop processing on first abort", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockResolvedValue({
        resultType: "abort",
        reason: "Blocked by first hook",
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn();

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("abort");
      expect(hook1.processNotification).toHaveBeenCalled();
      expect(hook2.processNotification).not.toHaveBeenCalled();
    });

    it("should skip hooks that don't implement notification processing", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      // Don't implement processNotification

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, hook2: true },
        },
      });

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("continue");
      expect(hook2.processNotification).toHaveBeenCalled();
      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("hook2", true);
      }
    });
  });

  describe("processNotificationThroughHooks with reverse direction", () => {
    it("should process notification through hooks in reverse order", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const callOrder: string[] = [];

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook1");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook1: true },
          },
        };
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook2");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook2: true },
          },
        };
      });

      const hook3 = new MockHook("hook3");
      hook3.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook3");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook3: true },
          },
        };
      });

      const chain = new HookChain([hook1, hook2, hook3]);

      // Process in reverse direction (start from tail)
      const result = await processNotificationThroughHooks(
        notification,
        chain.tail,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("continue");
      // Should process in reverse order: hook3 -> hook2 -> hook1
      expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);

      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("hook1", true);
        expect(result.notification.params).toHaveProperty("hook2", true);
        expect(result.notification.params).toHaveProperty("hook3", true);
      }
    });

    it("should handle single hook in reverse direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const mockHook = new MockHook("test-hook");
      mockHook.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, modified: true },
        },
      });

      const chain = new HookChain([mockHook]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.tail,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("continue");
      expect(mockHook.processNotification).toHaveBeenCalledWith(notification);
      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("modified", true);
      }
    });

    it("should handle abort in reverse direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn();

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockResolvedValue({
        resultType: "abort",
        reason: "Notification blocked by hook2",
      });

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.tail,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("abort");
      // hook2 should be called first and abort
      expect(hook2.processNotification).toHaveBeenCalledWith(notification);
      // hook1 should not be called due to abort
      expect(hook1.processNotification).not.toHaveBeenCalled();
      if (result.resultType === "abort") {
        expect(result.reason).toBe("Notification blocked by hook2");
      }
    });

    it("should skip hooks that don't implement method in reverse direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      // Don't implement processNotification

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          ...notification,
          params: { ...notification.params, hook2: true },
        },
      });

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.tail,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("continue");
      expect(hook2.processNotification).toHaveBeenCalledWith(notification);
      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("hook2", true);
      }
    });

    it("should process empty chain in reverse direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const result = await processNotificationThroughHooks(
        notification,
        null,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.notification).toEqual(notification);
      }
    });

    it("should start from specified hook in reverse direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const callOrder: string[] = [];

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook1");
        return { resultType: "continue", notification: notif };
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook2");
        return { resultType: "continue", notification: notif };
      });

      const hook3 = new MockHook("hook3");
      hook3.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook3");
        return { resultType: "continue", notification: notif };
      });

      const chain = new HookChain([hook1, hook2, hook3]);

      // Start from hook2 (middle of chain) in reverse direction
      const result = await processNotificationThroughHooks(
        notification,
        chain.head?.next,
        "processNotification",
        "reverse",
      );

      expect(result.resultType).toBe("continue");
      // Should process hook2 -> hook1 (hook3 should not be called)
      expect(callOrder).toEqual(["hook2", "hook1"]);
      expect(hook3.processNotification).not.toHaveBeenCalled();
    });
  });

  describe("processNotificationThroughHooks with forward direction", () => {
    it("should process notification through hooks in forward order (explicit)", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const callOrder: string[] = [];

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook1");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook1: true },
          },
        };
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook2");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook2: true },
          },
        };
      });

      const hook3 = new MockHook("hook3");
      hook3.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook3");
        return {
          resultType: "continue",
          notification: {
            ...notif,
            params: { ...notif.params, hook3: true },
          },
        };
      });

      const chain = new HookChain([hook1, hook2, hook3]);

      // Process in forward direction (start from head)
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
        "forward",
      );

      expect(result.resultType).toBe("continue");
      // Should process in forward order: hook1 -> hook2 -> hook3
      expect(callOrder).toEqual(["hook1", "hook2", "hook3"]);

      if (result.resultType === "continue") {
        expect(result.notification.params).toHaveProperty("hook1", true);
        expect(result.notification.params).toHaveProperty("hook2", true);
        expect(result.notification.params).toHaveProperty("hook3", true);
      }
    });

    it("should handle abort in forward direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockResolvedValue({
        resultType: "abort",
        reason: "Notification blocked by hook1",
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn();

      const chain = new HookChain([hook1, hook2]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
        "forward",
      );

      expect(result.resultType).toBe("abort");
      // hook1 should be called first and abort
      expect(hook1.processNotification).toHaveBeenCalledWith(notification);
      // hook2 should not be called due to abort
      expect(hook2.processNotification).not.toHaveBeenCalled();
      if (result.resultType === "abort") {
        expect(result.reason).toBe("Notification blocked by hook1");
      }
    });

    it("should start from specified hook in forward direction", async () => {
      const notification = {
        method: "notifications/progress",
        params: { progress: 50, operation: "processing" },
      };

      const callOrder: string[] = [];

      const hook1 = new MockHook("hook1");
      hook1.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook1");
        return { resultType: "continue", notification: notif };
      });

      const hook2 = new MockHook("hook2");
      hook2.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook2");
        return { resultType: "continue", notification: notif };
      });

      const hook3 = new MockHook("hook3");
      hook3.processNotification = vi.fn().mockImplementation(async (notif) => {
        callOrder.push("hook3");
        return { resultType: "continue", notification: notif };
      });

      const chain = new HookChain([hook1, hook2, hook3]);

      // Start from hook2 (middle of chain) in forward direction
      const result = await processNotificationThroughHooks(
        notification,
        chain.head?.next,
        "processNotification",
        "forward",
      );

      expect(result.resultType).toBe("continue");
      // Should process hook2 -> hook3 (hook1 should not be called)
      expect(callOrder).toEqual(["hook2", "hook3"]);
      expect(hook1.processNotification).not.toHaveBeenCalled();
    });
  });
});
