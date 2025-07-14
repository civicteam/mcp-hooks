import type {
  Hook,
  TransportError,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
  ToolCallTransportErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ListToolsTransportErrorHookResult,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types";
import { describe, expect, it, vi } from "vitest";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
  processTransportErrorThroughHooks,
} from "./processor.js";

// Helper to create a tool call request
const createToolCall = (params: CallToolRequest["params"]): CallToolRequest => ({
  params,
  method: "tools/call",
});

// Helper to create a tools list request
const createToolsList = (params: ListToolsRequest["params"] = {}): ListToolsRequest => ({
  params,
  method: "tools/list",
});

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
        >(toolCall, [], "processToolCallRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedIndex).toBe(-1);
        if (result.resultType === "continue") {
          expect(result.request).toEqual(toolCall);
        }
      });

      it("should process request through single approving hook", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const mockHook: Hook = {
          get name() { return "test-hook"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "continue",
            request: toolCall,
          } satisfies ToolCallRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, [mockHook], "processToolCallRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedIndex).toBe(0);
        expect(mockHook.processToolCallRequest).toHaveBeenCalledWith(toolCall);
      });

      it("should handle hook rejection", async () => {
        const toolCall = createToolCall({
          name: "delete",
          arguments: { path: "/important" },
        });

        const mockHook: Hook = {
          get name() { return "security-hook"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "abort",
            reason: "Destructive operation",
          } satisfies ToolCallRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, [mockHook], "processToolCallRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedIndex).toBe(0);
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Destructive operation");
        }
      });

      it("should stop processing on first rejection", async () => {
        const toolCall = createToolCall({
          name: "fetch",
          arguments: { url: "https://example.com" },
        });

        const hook1: Hook = {
          get name() { return "hook1"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "continue",
            request: toolCall,
          } satisfies ToolCallRequestHookResult),
        };

        const hook2: Hook = {
          get name() { return "hook2"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "abort",
            reason: "Blocked by hook2",
          } satisfies ToolCallRequestHookResult),
        };

        const hook3: Hook = {
          get name() { return "hook3"; },
          processToolCallRequest: vi.fn(),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, [hook1, hook2, hook3], "processToolCallRequest");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedIndex).toBe(1);
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

        const mockHook: Hook = {
          get name() { return "modifier-hook"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "continue",
            request: modifiedToolCall,
          } satisfies ToolCallRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(originalToolCall, [mockHook], "processToolCallRequest");

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

        const hook1: Hook = {
          get name() { return "hook1"; },
          // No processToolCallRequest method
        };

        const hook2: Hook = {
          get name() { return "hook2"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "continue",
            request: toolCall,
          } satisfies ToolCallRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, [hook1, hook2], "processToolCallRequest");

        expect(result.lastProcessedIndex).toBe(1);
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

        const mockHook: Hook = {
          get name() { return "cache-hook"; },
          processToolCallRequest: vi.fn().mockResolvedValue({
            resultType: "respond",
            response: mockResponse,
          } as ToolCallRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallRequest"
        >(toolCall, [mockHook], "processToolCallRequest");

        expect(result.resultType).toBe("respond");
        expect(result.lastProcessedIndex).toBe(0);
        if (result.resultType === "respond") {
          expect(result.response).toEqual(mockResponse);
        }
      });
    });

    describe("with ListToolsRequest", () => {
      it("should process tools list request through hooks", async () => {
        const request = createToolsList();

        const mockHook: Hook = {
          get name() { return "test-hook"; },
          processToolsListRequest: vi.fn().mockResolvedValue({
            resultType: "continue",
            request,
          } satisfies ListToolsRequestHookResult),
        };

        const result = await processRequestThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processToolsListRequest"
        >(request, [mockHook], "processToolsListRequest");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedIndex).toBe(0);
        expect(mockHook.processToolsListRequest).toHaveBeenCalledWith(request);
      });
    });
  });

  describe("processResponseThroughHooks", () => {
    describe("with CallToolResult", () => {
      it("should process response through hooks in reverse order", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "test response" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });
        const callOrder: string[] = [];

        const hooks: Hook[] = [
          {
            get name() { return "hook1"; },
            processToolCallResponse: vi.fn().mockImplementation(async () => {
              callOrder.push("hook1");
              return { resultType: "continue", response } as ToolCallResponseHookResult;
            }),
          },
          {
            get name() { return "hook2"; },
            processToolCallResponse: vi.fn().mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", response } as ToolCallResponseHookResult;
            }),
          },
          {
            get name() { return "hook3"; },
            processToolCallResponse: vi.fn().mockImplementation(async () => {
              callOrder.push("hook3");
              return { resultType: "continue", response } as ToolCallResponseHookResult;
            }),
          },
        ];

        await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(response, toolCall, hooks, 2, "processToolCallResponse");

        expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
      });

      it("should handle response rejection", async () => {
        const response: CallToolResult = {
          content: [{ type: "text", text: "sensitive data" }],
        };
        const toolCall = createToolCall({ name: "fetch", arguments: {} });

        const mockHook: Hook = {
          get name() { return "filter-hook"; },
          processToolCallResponse: vi.fn().mockResolvedValue({
            resultType: "abort",
            reason: "Sensitive content",
          } satisfies ToolCallResponseHookResult),
        };

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(response, toolCall, [mockHook], 0, "processToolCallResponse");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedIndex).toBe(0);
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

        const mockHook: Hook = {
          get name() { return "modifier-hook"; },
          processToolCallResponse: vi.fn().mockResolvedValue({
            resultType: "continue",
            response: modifiedResponse,
          } as ToolCallResponseHookResult),
        };

        const result = await processResponseThroughHooks<
          CallToolRequest,
          CallToolResult,
          "processToolCallResponse"
        >(originalResponse, toolCall, [mockHook], 0, "processToolCallResponse");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedIndex).toBe(0);
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

        const mockHook: Hook = {
          get name() { return "test-hook"; },
          processToolsListResponse: vi.fn().mockResolvedValue({
            resultType: "continue",
            response,
          } as ListToolsResponseHookResult),
        };

        const result = await processResponseThroughHooks<
          ListToolsRequest,
          ListToolsResult,
          "processToolsListResponse"
        >(response, request, [mockHook], 0, "processToolsListResponse");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processToolsListResponse).toHaveBeenCalledWith(response, request);
      });
    });
  });

  describe("processTransportErrorThroughHooks", () => {
    describe("with CallToolRequest", () => {
      it("should process error through hooks in reverse order", async () => {
        const error: TransportError = { code: -32603, message: "Internal error" };
        const callOrder: string[] = [];

        const hooks: Hook[] = [
          {
            get name() { return "hook1"; },
            processToolCallTransportError: vi.fn().mockImplementation(async () => {
              callOrder.push("hook1");
              return { resultType: "continue", error } satisfies ToolCallTransportErrorHookResult;
            }),
          },
          {
            get name() { return "hook2"; },
            processToolCallTransportError: vi.fn().mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error } satisfies ToolCallTransportErrorHookResult;
            }),
          },
          {
            get name() { return "hook3"; },
            processToolCallTransportError: vi.fn().mockImplementation(async () => {
              callOrder.push("hook3");
              return { resultType: "continue", error } satisfies ToolCallTransportErrorHookResult;
            }),
          },
        ];

        const toolCall = createToolCall({ name: "test", arguments: {} });
        await processTransportErrorThroughHooks<
          CallToolRequest,
          "processToolCallTransportError"
        >(error, toolCall, hooks, 2, "processToolCallTransportError");

        expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
      });

      it("should skip hooks without the transport error method", async () => {
        const error: TransportError = { code: 401, message: "Unauthorized" };
        const callOrder: string[] = [];

        const hooks: Hook[] = [
          {
            get name() { return "hook1"; },
            // No processToolCallTransportError
          },
          {
            get name() { return "hook2"; },
            processToolCallTransportError: vi.fn().mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error } satisfies ToolCallTransportErrorHookResult;
            }),
          },
        ];

        const toolCall = createToolCall({ name: "test", arguments: {} });
        const result = await processTransportErrorThroughHooks<
          CallToolRequest,
          "processToolCallTransportError"
        >(error, toolCall, hooks, 1, "processToolCallTransportError");

        expect(callOrder).toEqual(["hook2"]);
        expect(result.resultType).toBe("continue");
        if (result.resultType === "continue") {
          expect(result.error).toEqual(error);
        }
      });

      it("should handle error abort", async () => {
        const error: TransportError = { code: 401, message: "Unauthorized" };

        const mockHook: Hook = {
          get name() { return "auth-hook"; },
          processToolCallTransportError: vi.fn().mockResolvedValue({
            resultType: "abort",
            reason: "Authentication required",
          } satisfies ToolCallTransportErrorHookResult),
        };

        const toolCall = createToolCall({ name: "test", arguments: {} });
        const result = await processTransportErrorThroughHooks<
          CallToolRequest,
          "processToolCallTransportError"
        >(error, toolCall, [mockHook], 0, "processToolCallTransportError");

        expect(result.resultType).toBe("abort");
        expect(result.lastProcessedIndex).toBe(0);
        if (result.resultType === "abort") {
          expect(result.reason).toBe("Authentication required");
        }
      });

      it("should allow hooks to modify error", async () => {
        const originalError: TransportError = { code: 401, message: "Unauthorized" };
        const modifiedError: TransportError = {
          code: 401,
          message: "Please authenticate",
          data: { customField: "retry-auth" },
        };

        const mockHook: Hook = {
          get name() { return "error-modifier-hook"; },
          processToolCallTransportError: vi.fn().mockResolvedValue({
            resultType: "continue",
            error: modifiedError,
          } satisfies ToolCallTransportErrorHookResult),
        };

        const toolCall = createToolCall({ name: "test", arguments: {} });
        const result = await processTransportErrorThroughHooks<
          CallToolRequest,
          "processToolCallTransportError"
        >(originalError, toolCall, [mockHook], 0, "processToolCallTransportError");

        expect(result.resultType).toBe("continue");
        expect(result.lastProcessedIndex).toBe(0);
        if (result.resultType === "continue") {
          expect(result.error).toEqual(modifiedError);
        }
      });
    });

    describe("with ListToolsRequest", () => {
      it("should process tools list transport error through hooks", async () => {
        const error: TransportError = { code: -32603, message: "Internal error" };
        const request = createToolsList();

        const mockHook: Hook = {
          get name() { return "test-hook"; },
          processToolsListTransportError: vi.fn().mockResolvedValue({
            resultType: "continue",
            error,
          } satisfies ListToolsTransportErrorHookResult),
        };

        const result = await processTransportErrorThroughHooks<
          ListToolsRequest,
          "processToolsListTransportError"
        >(error, request, [mockHook], 0, "processToolsListTransportError");

        expect(result.resultType).toBe("continue");
        expect(mockHook.processToolsListTransportError).toHaveBeenCalledWith(error, request);
      });
    });
  });
});