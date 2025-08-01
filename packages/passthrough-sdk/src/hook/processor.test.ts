import type {
  CallToolRequestWithContext,
  Hook,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
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

// Helper to create a mock hook that properly implements the Hook interface
class MockHook implements Hook {
  constructor(private _name: string) {}

  get name(): string {
    return this._name;
  }

  // Default implementations that satisfy the interface
  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    return { resultType: "continue", request };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalRequest: CallToolRequestWithContext,
  ): Promise<ToolCallResponseHookResult> {
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
          "processToolCallRequest"
        >(toolCall, null, "processToolCallRequest");

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
        mockHook.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies ToolCallRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processToolCallRequest).toHaveBeenCalledWith(toolCall);
      });

      it("should handle hook rejection", async () => {
        const toolCall = createToolCall({
          name: "delete",
          arguments: { path: "/important" },
        });

        const mockHook = new MockHook("security-hook");
        mockHook.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Destructive operation",
        } satisfies ToolCallRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

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
        hook1.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies ToolCallRequestHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        } satisfies ToolCallRequestHookResult);

        const hook3 = new MockHook("hook3");
        hook3.processToolCallRequest = vi.fn();

        const chain = new HookChain([hook1, hook2, hook3]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedHook?.name).toBe("hook2");
        expect(hook1.processToolCallRequest).toHaveBeenCalled();
        expect(hook2.processToolCallRequest).toHaveBeenCalled();
        expect(hook3.processToolCallRequest).not.toHaveBeenCalled();
      });

      it("should allow hooks to modify request", async () => {
        const originalToolCall = createToolCall({
          name: "fetch",
          arguments: { url: "http://example.com" },
        });

        const modifiedToolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" }, // Changed to HTTPS
        });

        const mockHook = new MockHook("modifier-hook");
        mockHook.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: modifiedToolCall,
        } satisfies ToolCallRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(originalToolCall, chain.head, "processToolCallRequest");

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
        (hook1 as any).processToolCallRequest = undefined;

        const hook2 = new MockHook("hook2");
        hook2.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        } satisfies ToolCallRequestHookResult);

        const chain = new HookChain([hook1, hook2]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

        expect(result.lastProcessedHook?.name).toBe("hook2");
        expect(hook2.processToolCallRequest).toHaveBeenCalled();
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
        mockHook.processToolCallRequest = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: mockResponse,
        } as ToolCallRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

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
        hook1.processToolCallRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook1-request");
          return {
            resultType: "continue",
            request: toolCall,
          } satisfies ToolCallRequestHookResult;
        });
        hook1.processToolCallResponse = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook1-response");
          return {
            resultType: "continue",
            response: modifiedResponse,
          } satisfies ToolCallResponseHookResult;
        });

        const hook2 = new MockHook("hook2");
        hook2.processToolCallRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook2-request");
          return {
            resultType: "respond",
            response: directResponse,
          } satisfies ToolCallRequestHookResult;
        });
        hook2.processToolCallResponse = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook2-response");
          return {
            resultType: "continue",
            response: directResponse,
          } satisfies ToolCallResponseHookResult;
        });

        const hook3 = new MockHook("hook3");
        hook3.processToolCallRequest = vi.fn().mockImplementation(async () => {
          requestCallOrder.push("hook3-request");
          return {
            resultType: "continue",
            request: toolCall,
          } satisfies ToolCallRequestHookResult;
        });
        hook3.processToolCallResponse = vi.fn().mockImplementation(async () => {
          responseCallOrder.push("hook3-response");
          return {
            resultType: "continue",
            response: directResponse,
          } satisfies ToolCallResponseHookResult;
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        // Process request - should stop at hook2
        const requestResult = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, chain.head, "processToolCallRequest");

        expect(requestResult.resultType).toBe("respond");
        expect(requestResult.lastProcessedHook?.name).toBe("hook2");
        expect(requestCallOrder).toEqual(["hook1-request", "hook2-request"]);
        expect(hook3.processToolCallRequest).not.toHaveBeenCalled();

        // Process response - should only process hooks that saw the request (hook2 and hook1)
        const responseResult = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(
          directResponse,
          toolCall,
          requestResult.lastProcessedHook,
          "processToolCallResponse",
        );

        // Verify only hook2 and hook1 processed the response (in reverse order)
        expect(responseCallOrder).toEqual(["hook2-response", "hook1-response"]);
        expect(hook3.processToolCallResponse).not.toHaveBeenCalled();

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
          async processToolsListRequest(
            request: ListToolsRequest,
          ): Promise<ListToolsRequestHookResult> {
            return { resultType: "continue", request };
          }
        }

        const mockHook = new ToolsListHook("test-hook");
        mockHook.processToolsListRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request,
        } satisfies ListToolsRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processToolsListRequest"
        >(request, chain.head, "processToolsListRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processToolsListRequest).toHaveBeenCalledWith(request);
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
          "processToolCallResponse"
        >(response, toolCall, null, "processToolCallResponse");

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
        hook1.processToolCallResponse = vi.fn().mockImplementation(async () => {
          callOrder.push("hook1");
          return {
            resultType: "continue",
            response,
          } satisfies ToolCallResponseHookResult;
        });

        const hook2 = new MockHook("hook2");
        hook2.processToolCallResponse = vi.fn().mockImplementation(async () => {
          callOrder.push("hook2");
          return {
            resultType: "continue",
            response,
          } satisfies ToolCallResponseHookResult;
        });

        const hook3 = new MockHook("hook3");
        hook3.processToolCallResponse = vi.fn().mockImplementation(async () => {
          callOrder.push("hook3");
          return {
            resultType: "continue",
            response,
          } satisfies ToolCallResponseHookResult;
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(response, toolCall, chain.tail, "processToolCallResponse");

        expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
      });

      it("should handle response rejection", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "sensitive data" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const mockHook = new MockHook("filter-hook");
        mockHook.processToolCallResponse = vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Sensitive content",
        } satisfies ToolCallResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(response, toolCall, chain.head, "processToolCallResponse");

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
        mockHook.processToolCallResponse = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: modifiedResponse,
        } satisfies ToolCallResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(originalResponse, toolCall, chain.head, "processToolCallResponse");

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
          async processToolsListResponse(
            response: ListToolsResult,
            originalRequest: ListToolsRequest,
          ): Promise<ListToolsResponseHookResult> {
            return { resultType: "continue", response };
          }
        }

        const mockHook = new ToolsListHook("test-hook");
        mockHook.processToolsListResponse = vi.fn().mockResolvedValue({
          resultType: "continue",
          response,
        } satisfies ListToolsResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processToolsListResponse"
        >(response, request, chain.head, "processToolsListResponse");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processToolsListResponse).toHaveBeenCalledWith(
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
        "processToolCallRequest"
      >(toolCall, null, "processToolCallRequest");

      expect(requestResult.resultType).toBe("continue");
      expect(requestResult.lastProcessedHook).toBe(null);
      if (requestResult.resultType === "continue") {
        expect(requestResult.request).toEqual(toolCall);
      }

      // Process response using the null lastProcessedHook
      const responseResult = await processResponseThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processToolCallResponse"
      >(
        response,
        toolCall,
        requestResult.lastProcessedHook,
        "processToolCallResponse",
      );

      expect(responseResult.resultType).toBe("continue");
      expect(responseResult.lastProcessedHook).toBe(null);
      if (responseResult.resultType === "continue") {
        expect(responseResult.response).toEqual(response);
      }
    });
  });
});
