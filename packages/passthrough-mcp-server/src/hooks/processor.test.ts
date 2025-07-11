import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
} from "@modelcontextprotocol/sdk/types";
import { describe, expect, it, vi } from "vitest";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
  processToolCallTransportErrorThroughHooks,
  processToolsListTransportErrorThroughHooks,
} from "./processor.js";

const toToolCall = (params: CallToolRequest["params"]): CallToolRequest => ({
  params,
  method: "tools/call",
});

describe("Hook Processor", () => {
  describe("processRequestThroughHooks", () => {
    it("should process request through empty hook chain", async () => {
      const toolCall = toToolCall({
        name: "fetch",
        arguments: { url: "https://example.com" },
      });

      const result = await processRequestThroughHooks(toolCall, []);

      expect(result.resultType).toEqual("continue");
      expect(result.lastProcessedIndex).toBe(-1);
    });

    it("should process request through single approving hook", async () => {
      const toolCall = toToolCall({
        name: "fetch",
        arguments: { url: "https://example.com" },
      });

      const mockHook = {
        name: "test-hook",
        processToolCallRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        }),
        processToolCallResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.resultType).toBe("continue");
      expect((result as any).request).toEqual(toolCall);
      expect(result.lastProcessedIndex).toBe(0);
      expect(mockHook.processToolCallRequest).toHaveBeenCalledWith(toolCall);
    });

    it("should handle hook rejection", async () => {
      const toolCall = toToolCall({
        name: "delete",
        arguments: { path: "/important" },
      });

      const mockHook = {
        name: "security-hook",
        processToolCallRequest: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Destructive operation",
        }),
        processToolCallResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.resultType).toBe("abort");
      expect((result as any).reason).toBe("Destructive operation");
      expect(result.lastProcessedIndex).toBe(0);
    });

    it("should stop processing on first rejection", async () => {
      const toolCall = toToolCall({
        name: "fetch",
        arguments: { url: "https://example.com" },
      });

      const hook1 = {
        name: "hook1",
        processToolCallRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        }),
        processToolCallResponse: vi.fn(),
      };

      const hook2 = {
        name: "hook2",
        processToolCallRequest: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        }),
        processToolCallResponse: vi.fn(),
      };

      const hook3 = {
        name: "hook3",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        hook1,
        hook2,
        hook3,
      ] as Parameters<typeof processRequestThroughHooks>[1]);

      expect(result.resultType).toBe("abort");
      expect(result.lastProcessedIndex).toBe(1);
      expect(hook1.processToolCallRequest).toHaveBeenCalled();
      expect(hook2.processToolCallRequest).toHaveBeenCalled();
      expect(hook3.processToolCallRequest).not.toHaveBeenCalled();
    });

    it("should allow hooks to modify tool call", async () => {
      const originalToolCall = toToolCall({
        name: "fetch",
        arguments: { url: "http://example.com" },
      });

      const modifiedToolCall = toToolCall({
        name: "fetch",
        arguments: { url: "https://example.com" }, // Changed to HTTPS
      });

      const mockHook = {
        name: "modifier-hook",
        processToolCallRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: modifiedToolCall,
        }),
        processToolCallResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(originalToolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect((result as any).request).toEqual(modifiedToolCall);
      expect((result as any).request.params.arguments.url).toBe(
        "https://example.com",
      );
    });
  });

  describe("processResponseThroughHooks", () => {
    it("should process response through hooks in reverse order", async () => {
      const response: CallToolResult = {
        content: [{ type: "text" as const, text: "test response" }],
      };
      const toolCall = toToolCall({ name: "fetch", arguments: {} });
      const callOrder: string[] = [];

      const hooks = [
        {
          name: "hook1",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook1");
            return { resultType: "continue", response: response };
          }),
        },
        {
          name: "hook2",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook2");
            return { resultType: "continue", response: response };
          }),
        },
        {
          name: "hook3",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook3");
            return { resultType: "continue", response: response };
          }),
        },
      ];

      await processResponseThroughHooks(
        response,
        toolCall,
        hooks as Parameters<typeof processResponseThroughHooks>[2],
        2,
      );

      expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
    });

    it("should handle response rejection", async () => {
      const response: CallToolResult = {
        content: [{ type: "text" as const, text: "sensitive data" }],
      };
      const toolCall = toToolCall({ name: "fetch", arguments: {} });

      const mockHook = {
        name: "filter-hook",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Sensitive content",
        }),
      };

      const result = await processResponseThroughHooks(
        response,
        toolCall,
        [mockHook] as Parameters<typeof processResponseThroughHooks>[2],
        0,
      );

      expect(result.resultType).toBe("abort");
      expect((result as any).reason).toBe("Sensitive content");
      expect(result.lastProcessedIndex).toBe(0);
    });

    it("should allow hooks to modify response", async () => {
      const originalResponse: CallToolResult = {
        content: [{ type: "text" as const, text: "original" }],
      };
      const modifiedResponse: CallToolResult = {
        content: [{ type: "text" as const, text: "modified" }],
      };
      const toolCall = toToolCall({ name: "fetch", arguments: {} });

      const mockHook = {
        name: "modifier-hook",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn().mockResolvedValue({
          resultType: "continue",
          response: modifiedResponse,
        }),
      };

      const result = await processResponseThroughHooks(
        originalResponse,
        toolCall,
        [mockHook] as Parameters<typeof processResponseThroughHooks>[2],
        0,
      );

      expect(result.resultType).toBe("continue");
      expect((result as any).response).toEqual(modifiedResponse);
      expect(result.lastProcessedIndex).toBe(0);
    });
  });

  describe("processToolCallTransportErrorThroughHooks", () => {
    it("should process error through hooks in reverse order", async () => {
      const error = { code: -32603, message: "Internal error" };
      const callOrder: string[] = [];

      const hooks = [
        {
          name: "hook1",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolCallTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook1");
              return { resultType: "continue", error };
            }),
        },
        {
          name: "hook2",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolCallTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error };
            }),
        },
        {
          name: "hook3",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolCallTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook3");
              return { resultType: "continue", error };
            }),
        },
      ];

      const toolCall = toToolCall({ name: "test", arguments: {} });
      await processToolCallTransportErrorThroughHooks(
        error,
        toolCall,
        hooks as Parameters<
          typeof processToolCallTransportErrorThroughHooks
        >[2],
        2,
      );

      expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
    });

    it("should skip hooks without processToolCallTransportError", async () => {
      const error = { code: 401, message: "Unauthorized" };
      const callOrder: string[] = [];

      const hooks = [
        {
          name: "hook1",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          // No processToolCallTransportError
        },
        {
          name: "hook2",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolCallTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error };
            }),
        },
      ];

      const toolCall = toToolCall({ name: "test", arguments: {} });
      const result = await processToolCallTransportErrorThroughHooks(
        error,
        toolCall,
        hooks as Parameters<
          typeof processToolCallTransportErrorThroughHooks
        >[2],
        1,
      );

      expect(callOrder).toEqual(["hook2"]);
      expect(result.resultType).toBe("continue");
      expect(result.error).toEqual(error);
    });

    it("should handle error abort", async () => {
      const error = { code: 401, message: "Unauthorized" };

      const mockHook = {
        name: "auth-hook",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolCallTransportError: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Authentication required",
        }),
      };

      const toolCall = toToolCall({ name: "test", arguments: {} });
      const result = await processToolCallTransportErrorThroughHooks(
        error,
        toolCall,
        [mockHook] as Parameters<
          typeof processToolCallTransportErrorThroughHooks
        >[2],
        0,
      );

      expect(result.resultType).toBe("abort");
      expect((result as any).reason).toBe("Authentication required");
      expect(result.lastProcessedIndex).toBe(0);
    });

    it("should allow hooks to modify error", async () => {
      const originalError = { code: 401, message: "Unauthorized" };
      const modifiedError = {
        code: 401,
        message: "Please authenticate",
        customField: "retry-auth",
      };

      const mockHook = {
        name: "error-modifier-hook",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolCallTransportError: vi.fn().mockResolvedValue({
          resultType: "continue",
          error: modifiedError,
        }),
      };

      const toolCall = toToolCall({ name: "test", arguments: {} });
      const result = await processToolCallTransportErrorThroughHooks(
        originalError,
        toolCall,
        [mockHook] as Parameters<
          typeof processToolCallTransportErrorThroughHooks
        >[2],
        0,
      );

      expect(result.resultType).toBe("continue");
      expect(result.error).toEqual(modifiedError);
      expect(result.lastProcessedIndex).toBe(0);
    });

    it("should stop processing on first abort", async () => {
      const error = { code: 401, message: "Unauthorized" };

      const hook1 = {
        name: "hook1",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolCallTransportError: vi.fn().mockResolvedValue({
          resultType: "continue",
          error,
        }),
      };

      const hook2 = {
        name: "hook2",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolCallTransportError: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        }),
      };

      const hook3 = {
        name: "hook3",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolCallTransportError: vi.fn().mockResolvedValue({
          resultType: "continue",
          error,
        }),
      };

      const toolCall = toToolCall({ name: "test", arguments: {} });
      const result = await processToolCallTransportErrorThroughHooks(
        error,
        toolCall,
        [hook1, hook2, hook3] as Parameters<
          typeof processToolCallTransportErrorThroughHooks
        >[2],
        2,
      );

      expect(result.resultType).toBe("abort");
      expect(result.lastProcessedIndex).toBe(1);
      expect(hook3.processToolCallTransportError).toHaveBeenCalled();
      expect(hook2.processToolCallTransportError).toHaveBeenCalled();
      expect(hook1.processToolCallTransportError).not.toHaveBeenCalled();
    });
  });

  describe("processToolsListTransportErrorThroughHooks", () => {
    it("should process error through hooks in reverse order", async () => {
      const error = { code: -32603, message: "Internal error" };
      const callOrder: string[] = [];
      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const hooks = [
        {
          name: "hook1",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolsListTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook1");
              return { resultType: "continue", error };
            }),
        },
        {
          name: "hook2",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolsListTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error };
            }),
        },
        {
          name: "hook3",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolsListTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook3");
              return { resultType: "continue", error };
            }),
        },
      ];

      await processToolsListTransportErrorThroughHooks(
        error,
        request,
        hooks as Parameters<
          typeof processToolsListTransportErrorThroughHooks
        >[2],
        2,
      );

      expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
    });

    it("should skip hooks without processToolsListTransportError", async () => {
      const error = { code: 401, message: "Unauthorized" };
      const callOrder: string[] = [];
      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const hooks = [
        {
          name: "hook1",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          // No processToolsListTransportError
        },
        {
          name: "hook2",
          processToolCallRequest: vi.fn(),
          processToolCallResponse: vi.fn(),
          processToolsListTransportError: vi
            .fn()
            .mockImplementation(async () => {
              callOrder.push("hook2");
              return { resultType: "continue", error };
            }),
        },
      ];

      const result = await processToolsListTransportErrorThroughHooks(
        error,
        request,
        hooks as Parameters<
          typeof processToolsListTransportErrorThroughHooks
        >[2],
        1,
      );

      expect(callOrder).toEqual(["hook2"]);
      expect(result.resultType).toBe("continue");
      expect(result.error).toEqual(error);
    });

    it("should handle error abort", async () => {
      const error = { code: 401, message: "Unauthorized" };
      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const mockHook = {
        name: "auth-hook",
        processToolCallRequest: vi.fn(),
        processToolCallResponse: vi.fn(),
        processToolsListTransportError: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Authentication required",
        }),
      };

      const result = await processToolsListTransportErrorThroughHooks(
        error,
        request,
        [mockHook] as Parameters<
          typeof processToolsListTransportErrorThroughHooks
        >[2],
        0,
      );

      expect(result.resultType).toBe("abort");
      expect((result as any).reason).toBe("Authentication required");
      expect(result.lastProcessedIndex).toBe(0);
    });
  });
});
