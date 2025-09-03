import type {
  CallToolErrorHookResult,
  CallToolRequestHookResult,
  CallToolRequestWithContext,
  CallToolResponseHookResult,
  Hook,
  HookChainError,
  InitializeErrorHookResult,
  ListPromptsErrorHookResult,
  ListPromptsRequestHookResult,
  ListPromptsResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  RequestExtra,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  InitializeRequest,
  InitializeResult,
  ListPromptsRequest,
  ListPromptsResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { HookChain } from "./hookChain.js";
import {
  processNotificationThroughHooks,
  processRequestThroughHooks,
  processResponseThroughHooks,
  toHookChainError,
} from "./processor.js";

// Mock RequestExtra for testing with all possible fields
const mockRequestExtra: RequestExtra = {
  requestId: "test-request-id",
  sessionId: "test-session-id",
  authInfo: {
    access_token: "test-token",
    token_type: "Bearer",
  },
  _meta: {
    test: "metadata",
  },
  requestInfo: {
    url: "http://test.example.com",
    method: "POST",
    headers: { "content-type": "application/json" },
  },
};

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

// Helper to create a prompts list request
const createPromptsList = (
  params: ListPromptsRequest["params"] = {},
): ListPromptsRequest => ({
  params,
  method: "prompts/list",
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
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    return { resultType: "continue", request };
  }

  async processCallToolResult(
    response: CallToolResult,
    originalRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    return { resultType: "continue", response };
  }

  async processListPromptsRequest?(
    request: ListPromptsRequest,
    requestExtra: RequestExtra,
  ): Promise<ListPromptsRequestHookResult> {
    return { resultType: "continue", request };
  }

  async processListPromptsResult?(
    response: ListPromptsResult,
    originalRequest: ListPromptsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsResponseHookResult> {
    return { resultType: "continue", response };
  }

  async processListToolsRequest?(
    request: ListToolsRequest,
    requestExtra: RequestExtra,
  ): Promise<ListToolsRequestHookResult> {
    return { resultType: "continue", request };
  }

  async processListToolsResult?(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsResponseHookResult> {
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
        >(toolCall, mockRequestExtra, null, "processCallToolRequest");

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
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processCallToolRequest).toHaveBeenCalledWith(
          toolCall,
          mockRequestExtra,
        );
      });

      it("should handle hook rejection", async () => {
        const toolCall = createToolCall({
          name: "delete",
          arguments: { path: "/important" },
        });

        const mockHook = new MockHook("security-hook");
        mockHook.processCallToolRequest = vi
          .fn()
          .mockRejectedValue(new Error("Destructive operation"));

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedHook?.name).toBe("security-hook");
        if (result.resultType === "abort") {
          expect(result.error.message).toBe("Destructive operation");
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
        hook2.processCallToolRequest = vi
          .fn()
          .mockRejectedValue(new Error("Blocked by hook2"));

        const hook3 = new MockHook("hook3");
        hook3.processCallToolRequest = vi.fn();

        const chain = new HookChain([hook1, hook2, hook3]);
        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolRequest"
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

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
        >(
          originalCallToolRequest,
          mockRequestExtra,
          chain.head,
          "processCallToolRequest",
        );

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
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

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
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

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
        >(toolCall, mockRequestExtra, chain.head, "processCallToolRequest");

        expect(requestResult.resultType).toBe("respond");
        expect(requestResult.lastProcessedHook?.name).toBe("hook2");
        expect(requestCallOrder).toEqual(["hook1-request", "hook2-request"]);
        expect(hook3.processCallToolRequest).not.toHaveBeenCalled();

        // Process response - should only process hooks that saw the request (hook2 and hook1)
        const responseResult = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          directResponse,
          null,
          toolCall,
          mockRequestExtra,
          requestResult.lastProcessedHook,
          "processCallToolResult",
          "processCallToolError",
        );

        // Should process from hook2 backward to hook1 (hook3 was not in the request path)
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
        >(request, mockRequestExtra, chain.head, "processListToolsRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processListToolsRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
      });
    });

    describe("with ListPromptsRequest", () => {
      it("should process prompts list request through hooks", async () => {
        const request = createPromptsList();

        // Create a hook that supports prompts list
        class PromptsListHook extends MockHook {
          async processListPromptsRequest(
            request: ListPromptsRequest,
          ): Promise<ListPromptsRequestHookResult> {
            return { resultType: "continue", request };
          }
        }

        const mockHook = new PromptsListHook("test-hook");
        mockHook.processListPromptsRequest = vi.fn().mockResolvedValue({
          resultType: "continue",
          request,
        } satisfies ListPromptsRequestHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processRequestThroughHooks<
          ListPromptsRequest,
          ListPromptsResult,
          "processListPromptsRequest"
        >(request, mockRequestExtra, chain.head, "processListPromptsRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedHook?.name).toBe("test-hook");
        expect(mockHook.processListPromptsRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          toolCall,
          mockRequestExtra,
          null,
          "processCallToolResult",
          "processCallToolError",
        );

        expect(result.resultType).toBe("continue");
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          toolCall,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
      });

      it("should handle response rejection", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "sensitive data" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const mockHook = new MockHook("filter-hook");
        mockHook.processCallToolResult = vi
          .fn()
          .mockRejectedValue(new Error("Sensitive content"));

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          toolCall,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
        );

        expect(result.resultType).toBe("abort");
        if (result.resultType === "abort") {
          expect(result.error.message).toBe("Sensitive content");
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
          "processCallToolResult",
          "processCallToolError"
        >(
          originalResponse,
          null,
          toolCall,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
        );

        expect(result.resultType).toBe("continue");
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
          "processListToolsResult",
          "processListToolsError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processListToolsResult",
          "processListToolsError",
        );

        expect(result.resultType).toBe("continue");
        expect(mockHook.processListToolsResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
        );
      });
    });

    describe("with ListPromptsResult", () => {
      it("should process prompts list response through hooks", async () => {
        const response: ListPromptsResult = {
          prompts: [{ name: "test-prompt", description: "A test prompt" }],
        };
        const request = createPromptsList();

        // Create a hook that supports prompts list
        class PromptsListHook extends MockHook {
          async processListPromptsResult(
            response: ListPromptsResult,
            originalRequest: ListPromptsRequest,
          ): Promise<ListPromptsResponseHookResult> {
            return { resultType: "continue", response };
          }
        }

        const mockHook = new PromptsListHook("test-hook");
        mockHook.processListPromptsResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response,
        } satisfies ListPromptsResponseHookResult);

        const chain = new HookChain([mockHook]);
        const result = await processResponseThroughHooks<
          ListPromptsRequest,
          ListPromptsResult,
          "processListPromptsResult",
          "processListPromptsError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processListPromptsResult",
          "processListPromptsError",
        );

        expect(result.resultType).toBe("continue");
        expect(mockHook.processListPromptsResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
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
      >(toolCall, mockRequestExtra, null, "processCallToolRequest");

      expect(requestResult.resultType).toBe("continue");
      expect(requestResult.lastProcessedHook).toBe(null);
      if (requestResult.resultType === "continue") {
        expect(requestResult.request).toEqual(toolCall);
      }

      // Process response using the null lastProcessedHook
      const responseResult = await processResponseThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processCallToolResult",
        "processCallToolError"
      >(
        response,
        null,
        toolCall,
        mockRequestExtra,
        requestResult.lastProcessedHook,
        "processCallToolResult",
        "processCallToolError",
      );

      expect(responseResult.resultType).toBe("continue");
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
        >(
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolRequest",
          "reverse",
        );

        expect(result.resultType).toBe("continue");

        // hook2 should be called first (reverse order)
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
        expect(hook1.processCallToolRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({ hook2: true }),
          }),
          mockRequestExtra,
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
        >(
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolRequest",
          "reverse",
        );

        expect(result.resultType).toBe("continue");
        expect(mockHook.processCallToolRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
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
        >(
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolRequest",
          "reverse",
        );

        expect(result.resultType).toBe("abort");
        // hook2 should be called first and abort
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
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
        >(
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolRequest",
          "reverse",
        );

        expect(result.resultType).toBe("respond");
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
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
        >(
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolRequest",
          "reverse",
        );

        expect(result.resultType).toBe("continue");
        expect(hook2.processCallToolRequest).toHaveBeenCalledWith(
          request,
          mockRequestExtra,
        );
        if (result.resultType === "continue") {
          expect(result.request.params).toHaveProperty("hook2", true);
        }
      });
    });
  });

  describe("processResponseThroughHooks with error handling", () => {
    describe("error/response state transitions", () => {
      it("should handle error state through entire chain", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const error: HookChainError = {
          code: -32603,
          message: "Server error",
        };

        const hook1 = new MockHook("hook1");
        hook1.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "continue",
        } satisfies CallToolErrorHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "continue",
        } satisfies CallToolErrorHookResult);

        const chain = new HookChain([hook1, hook2]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          null, // no response
          error, // error state
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // Should call error handlers in reverse order
        expect(hook2.processCallToolError).toHaveBeenCalledWith(
          error,
          request,
          mockRequestExtra,
        );
        expect(hook1.processCallToolError).toHaveBeenCalledWith(
          error,
          request,
          mockRequestExtra,
        );

        // Should end in error state since no hook recovered
        expect(result.resultType).toBe("abort");
        if (result.resultType === "abort") {
          expect(result.error).toEqual(error);
        }
      });

      it("should recover from error to response state", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const error: HookChainError = {
          code: -32603,
          message: "Server error",
        };
        const recoveredResponse: CallToolResult = {
          content: [{ type: "text", text: "Recovered response" }],
        };

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: recoveredResponse,
        } satisfies CallToolResponseHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: recoveredResponse,
        } satisfies CallToolErrorHookResult);

        const chain = new HookChain([hook1, hook2]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          null,
          error,
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // hook2 should handle error and recover
        expect(hook2.processCallToolError).toHaveBeenCalledWith(
          error,
          request,
          mockRequestExtra,
        );

        // hook1 should process the recovered response
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          recoveredResponse,
          request,
          mockRequestExtra,
        );

        // Should end in response state
        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(recoveredResponse);
        }
      });

      it("should transition from response to error state when hook throws", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const response: CallToolResult = {
          content: [{ type: "text", text: "Initial response" }],
        };

        const hook1 = new MockHook("hook1");
        hook1.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "continue",
        } satisfies CallToolErrorHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi
          .fn()
          .mockRejectedValue(new Error("Processing failed"));

        const chain = new HookChain([hook1, hook2]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // hook2 should try to process response and throw
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
        );

        // hook1 should receive the error
        expect(hook1.processCallToolError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: -32603,
            message: "Processing failed",
          }),
          request,
          mockRequestExtra,
        );

        // Should end in error state
        expect(result.resultType).toBe("abort");
        if (result.resultType === "abort") {
          expect(result.error.message).toBe("Processing failed");
        }
      });

      it("should handle multiple state transitions", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const initialResponse: CallToolResult = {
          content: [{ type: "text", text: "Initial" }],
        };
        const recoveredResponse: CallToolResult = {
          content: [{ type: "text", text: "Recovered" }],
        };
        const finalResponse: CallToolResult = {
          content: [{ type: "text", text: "Final" }],
        };

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockResolvedValue({
          resultType: "continue",
          response: finalResponse,
        } satisfies CallToolResponseHookResult);

        const hook2 = new MockHook("hook2");
        hook2.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: recoveredResponse,
        } satisfies CallToolErrorHookResult);

        const hook3 = new MockHook("hook3");
        hook3.processCallToolResult = vi
          .fn()
          .mockRejectedValue(new Error("Hook3 error"));

        const chain = new HookChain([hook1, hook2, hook3]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          initialResponse,
          null,
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // hook3: response -> error (throws)
        expect(hook3.processCallToolResult).toHaveBeenCalledWith(
          initialResponse,
          request,
          mockRequestExtra,
        );

        // hook2: error -> response (recovers)
        expect(hook2.processCallToolError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Hook3 error",
          }),
          request,
          mockRequestExtra,
        );

        // hook1: response -> response (modifies)
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          recoveredResponse,
          request,
          mockRequestExtra,
        );

        // Should end with final response
        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(finalResponse);
        }
      });

      it("should skip hooks without appropriate methods", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const error: HookChainError = {
          code: -32603,
          message: "Test error",
        };
        const recoveredResponse: CallToolResult = {
          content: [{ type: "text", text: "Recovered" }],
        };

        const hook1 = new MockHook("hook1");
        // No error handler

        const hook2 = new MockHook("hook2");
        hook2.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: recoveredResponse,
        } satisfies CallToolErrorHookResult);

        const hook3 = new MockHook("hook3");
        // No response handler

        const chain = new HookChain([hook1, hook2, hook3]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          null,
          error,
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // hook3: no error handler, skipped
        // hook2: handles error and recovers
        expect(hook2.processCallToolError).toHaveBeenCalled();
        // hook1: no response handler, skipped

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(recoveredResponse);
        }
      });

      it("should handle neither response nor error provided", async () => {
        const request = createToolCall({ name: "test", arguments: {} });

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          null,
          null,
          request,
          mockRequestExtra,
          null,
          "processCallToolResult",
          "processCallToolError",
        );

        // Should create an internal error
        expect(result.resultType).toBe("abort");
        if (result.resultType === "abort") {
          expect(result.error.message).toContain(
            "processResponseThroughHooks was called without a response OR error",
          );
        }
      });

      it("should process entire chain even with errors", async () => {
        const request = createToolCall({ name: "test", arguments: {} });
        const response: CallToolResult = {
          content: [{ type: "text", text: "Initial" }],
        };

        const callOrder: string[] = [];

        const hook1 = new MockHook("hook1");
        hook1.processCallToolResult = vi.fn().mockImplementation(() => {
          callOrder.push("hook1-response");
          throw new Error("Hook1 error");
        });
        hook1.processCallToolError = vi.fn().mockImplementation(() => {
          callOrder.push("hook1-error");
          return { resultType: "continue" };
        });

        const hook2 = new MockHook("hook2");
        hook2.processCallToolResult = vi.fn().mockImplementation(() => {
          callOrder.push("hook2-response");
          return {
            resultType: "continue",
            response: { content: [{ type: "text", text: "Hook2" }] },
          };
        });
        hook2.processCallToolError = vi.fn().mockImplementation(() => {
          callOrder.push("hook2-error");
          return {
            resultType: "respond",
            response: { content: [{ type: "text", text: "Recovered" }] },
          };
        });

        const hook3 = new MockHook("hook3");
        hook3.processCallToolResult = vi.fn().mockImplementation(() => {
          callOrder.push("hook3-response");
          throw new Error("Hook3 error");
        });

        const chain = new HookChain([hook1, hook2, hook3]);

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.tail,
          "processCallToolResult",
          "processCallToolError",
        );

        // Verify entire chain was processed
        expect(callOrder).toEqual([
          "hook3-response", // throws
          "hook2-error", // recovers
          "hook1-response", // throws again
        ]);

        // Should end in error state
        expect(result.resultType).toBe("abort");
      });
    });

    describe("with different error types", () => {
      it("should handle ListToolsError", async () => {
        const request: ListToolsRequest = { method: "tools/list", params: {} };
        const error: HookChainError = {
          code: -32603,
          message: "Failed to list tools",
        };
        const recoveredResponse: ListToolsResult = {
          tools: [{ name: "fallback-tool", description: "Fallback" }],
        };

        const hook = new MockHook("tools-hook");
        hook.processListToolsError = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: recoveredResponse,
        } satisfies ListToolsErrorHookResult);

        const chain = new HookChain([hook]);

        const result = await processResponseThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processListToolsResult",
          "processListToolsError"
        >(
          null,
          error,
          request,
          mockRequestExtra,
          chain.head,
          "processListToolsResult",
          "processListToolsError",
        );

        expect(hook.processListToolsError).toHaveBeenCalledWith(
          error,
          request,
          mockRequestExtra,
        );

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(recoveredResponse);
        }
      });

      it("should handle InitializeError", async () => {
        const request: InitializeRequest = {
          method: "initialize",
          params: {
            protocolVersion: "1.0",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" },
          },
        };
        const error: HookChainError = {
          code: -32603,
          message: "Initialization failed",
        };
        const recoveredResponse: InitializeResult = {
          protocolVersion: "1.0",
          capabilities: {},
          serverInfo: { name: "fallback", version: "1.0" },
        };

        const hook = new MockHook("init-hook");
        hook.processInitializeError = vi.fn().mockResolvedValue({
          resultType: "respond",
          response: recoveredResponse,
        } satisfies InitializeErrorHookResult);

        const chain = new HookChain([hook]);

        const result = await processResponseThroughHooks<
          InitializeRequest,
          InitializeResult,
          "processInitializeResult",
          "processInitializeError"
        >(
          null,
          error,
          request,
          mockRequestExtra,
          chain.head,
          "processInitializeResult",
          "processInitializeError",
        );

        expect(hook.processInitializeError).toHaveBeenCalledWith(
          error,
          request,
          mockRequestExtra,
        );

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(recoveredResponse);
        }
      });
    });
  });

  describe("toHookChainError", () => {
    it("should handle McpError", () => {
      const mcpError = new McpError(-32603, "Test error", { extra: "data" });
      const result = toHookChainError(mcpError);

      expect(result.code).toBe(-32603);
      expect(result.message).toBe("MCP error -32603: Test error");
      expect(result.data).toEqual({ extra: "data" });
    });

    it("should handle standard Error", () => {
      const error = new Error("Standard error");
      const result = toHookChainError(error);

      expect(result).toEqual({
        code: -32603,
        message: "Standard error",
        data: {
          name: "Error",
          stack: expect.any(String),
        },
      });
    });

    it("should handle HookChainError passthrough", () => {
      const hookError: HookChainError = {
        code: -32000,
        message: "Custom error",
        data: { custom: "field" },
      };
      const result = toHookChainError(hookError);

      expect(result).toBe(hookError);
    });

    it("should handle object with error-like properties", () => {
      const errorLike = {
        code: -32001,
        message: "Error-like object",
        someOtherProp: "value",
      };
      const result = toHookChainError(errorLike);

      // Since it has code and message, it's treated as a HookChainError and returned as-is
      expect(result).toBe(errorLike);
      expect(result.code).toBe(-32001);
      expect(result.message).toBe("Error-like object");
    });

    it("should handle primitives", () => {
      const result = toHookChainError("string error");

      expect(result).toEqual({
        code: -32603,
        message: "string error",
      });
    });

    it("should handle null", () => {
      const result = toHookChainError(null);

      expect(result).toEqual({
        code: -32603,
        message: "null",
      });
    });

    it("should handle undefined", () => {
      const result = toHookChainError(undefined);

      expect(result).toEqual({
        code: -32603,
        message: "undefined",
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        expect(result.resultType).toBe("continue");

        // hook1 should be called first (forward order)
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
        );
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          expect.objectContaining({
            content: [{ type: "text", text: "modified-by-hook1" }],
          }),
          request,
          mockRequestExtra,
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        expect(mockHook.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
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
        hook1.processCallToolResult = vi
          .fn()
          .mockRejectedValue(new Error("Response blocked by hook1"));

        const hook2 = new MockHook("hook2");
        hook2.processCallToolError = vi.fn().mockResolvedValue({
          resultType: "continue",
        });

        const chain = new HookChain([hook1, hook2]);
        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        // hook1 should be called first and throw
        expect(hook1.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
        );
        // hook2 should receive the error since we process entire chain
        expect(hook2.processCallToolError).toHaveBeenCalled();

        // Should end in abort since no hook recovered from the error
        expect(result.resultType).toBe("abort");
        if (result.resultType === "abort") {
          expect(result.error.message).toBe("Response blocked by hook1");
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          null,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.response).toEqual(response);
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
          "processCallToolResult",
          "processCallToolError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head?.next,
          "processCallToolResult",
          "processCallToolError",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        // hook1 should not be called (we started from hook2)
        expect(hook1.processCallToolResult).not.toHaveBeenCalled();
        // hook2 and hook3 should be called
        expect(hook2.processCallToolResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
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
          "processListToolsResult",
          "processListToolsError"
        >(
          response,
          null,
          request,
          mockRequestExtra,
          chain.head,
          "processListToolsResult",
          "processListToolsError",
          "forward",
        );

        expect(result.resultType).toBe("continue");
        expect(hook.processListToolsResult).toHaveBeenCalledWith(
          response,
          request,
          mockRequestExtra,
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
      mockHook.processNotification = vi
        .fn()
        .mockRejectedValue(
          new Error("Notification blocked for security reasons"),
        );

      const chain = new HookChain([mockHook]);
      const result = await processNotificationThroughHooks(
        notification,
        chain.head,
        "processNotification",
      );

      expect(result.resultType).toBe("abort");
      if (result.resultType === "abort") {
        expect(result.error.message).toBe(
          "Notification blocked for security reasons",
        );
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
      hook1.processNotification = vi
        .fn()
        .mockRejectedValue(new Error("Blocked by first hook"));

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
      hook2.processNotification = vi
        .fn()
        .mockRejectedValue(new Error("Notification blocked by hook2"));

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
        expect(result.error.message).toBe("Notification blocked by hook2");
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
      hook1.processNotification = vi
        .fn()
        .mockRejectedValue(new Error("Notification blocked by hook1"));

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
        expect(result.error.message).toBe("Notification blocked by hook1");
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

  describe("RequestExtra propagation", () => {
    it("should pass complete RequestExtra to hooks including authInfo and requestInfo", async () => {
      const mockHook = new MockHook("test-hook");
      const processCallToolSpy = vi.spyOn(mockHook, "processCallToolRequest");
      const chain = new HookChain([mockHook]);

      const toolCall = createToolCall({
        name: "test-tool",
        arguments: { arg1: "value1" },
      });

      const fullRequestExtra: RequestExtra = {
        requestId: "full-request-id",
        sessionId: "full-session-id",
        authInfo: {
          access_token: "full-token",
          token_type: "Bearer",
          expires_in: 3600,
        },
        _meta: {
          custom: "metadata",
          version: "1.0",
        },
        requestInfo: {
          url: "https://api.example.com/tools",
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer full-token",
          },
        },
      };

      await processRequestThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processCallToolRequest"
      >(toolCall, fullRequestExtra, chain.head, "processCallToolRequest");

      expect(processCallToolSpy).toHaveBeenCalledWith(
        toolCall,
        fullRequestExtra,
      );

      // Verify all fields were passed
      const [, receivedExtra] = processCallToolSpy.mock.calls[0];
      expect(receivedExtra.requestId).toBe("full-request-id");
      expect(receivedExtra.sessionId).toBe("full-session-id");
      expect(receivedExtra.authInfo).toEqual({
        access_token: "full-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
      expect(receivedExtra._meta).toEqual({
        custom: "metadata",
        version: "1.0",
      });
      expect(receivedExtra.requestInfo).toEqual({
        url: "https://api.example.com/tools",
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer full-token",
        },
      });
    });

    it("should pass RequestExtra to response hooks with all fields", async () => {
      const mockHook = new MockHook("test-hook");
      const processCallToolResultSpy = vi.spyOn(
        mockHook,
        "processCallToolResult",
      );
      const chain = new HookChain([mockHook]);

      const toolCall = createToolCall({
        name: "test-tool",
        arguments: { arg1: "value1" },
      });

      const response: CallToolResult = {
        result: {
          content: [{ type: "text", text: "Tool executed successfully" }],
        },
      };

      const fullRequestExtra: RequestExtra = {
        requestId: "response-request-id",
        sessionId: "response-session-id",
        authInfo: {
          access_token: "response-token",
          token_type: "Bearer",
        },
        _meta: {
          responseTest: true,
        },
        requestInfo: {
          url: "https://api.example.com/response",
          method: "GET",
          headers: { accept: "application/json" },
        },
      };

      await processResponseThroughHooks<
        CallToolRequest,
        CallToolResult,
        "processCallToolResult",
        "processCallToolError"
      >(
        response,
        null,
        toolCall,
        fullRequestExtra,
        chain.head,
        "processCallToolResult",
        "processCallToolError",
      );

      expect(processCallToolResultSpy).toHaveBeenCalledWith(
        response,
        toolCall,
        fullRequestExtra,
      );

      // Verify all fields were passed
      const [, , receivedExtra] = processCallToolResultSpy.mock.calls[0];
      expect(receivedExtra.requestId).toBe("response-request-id");
      expect(receivedExtra.sessionId).toBe("response-session-id");
      expect(receivedExtra.authInfo).toEqual({
        access_token: "response-token",
        token_type: "Bearer",
      });
      expect(receivedExtra._meta).toEqual({
        responseTest: true,
      });
      expect(receivedExtra.requestInfo).toEqual({
        url: "https://api.example.com/response",
        method: "GET",
        headers: { accept: "application/json" },
      });
    });
  });
});
