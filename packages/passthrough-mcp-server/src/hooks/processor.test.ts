import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types";
import { describe, expect, it, vi } from "vitest";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
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
        processRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        }),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.resultType).toBe("continue");
      expect((result as any).request).toEqual(toolCall);
      expect(result.lastProcessedIndex).toBe(0);
      expect(mockHook.processRequest).toHaveBeenCalledWith(toolCall);
    });

    it("should handle hook rejection", async () => {
      const toolCall = toToolCall({
        name: "delete",
        arguments: { path: "/important" },
      });

      const mockHook = {
        name: "security-hook",
        processRequest: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Destructive operation",
        }),
        processResponse: vi.fn(),
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
        processRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: toolCall,
        }),
        processResponse: vi.fn(),
      };

      const hook2 = {
        name: "hook2",
        processRequest: vi.fn().mockResolvedValue({
          resultType: "abort",
          reason: "Blocked by hook2",
        }),
        processResponse: vi.fn(),
      };

      const hook3 = {
        name: "hook3",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        hook1,
        hook2,
        hook3,
      ] as Parameters<typeof processRequestThroughHooks>[1]);

      expect(result.resultType).toBe("abort");
      expect(result.lastProcessedIndex).toBe(1);
      expect(hook1.processRequest).toHaveBeenCalled();
      expect(hook2.processRequest).toHaveBeenCalled();
      expect(hook3.processRequest).not.toHaveBeenCalled();
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
        processRequest: vi.fn().mockResolvedValue({
          resultType: "continue",
          request: modifiedToolCall,
        }),
        processResponse: vi.fn(),
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
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook1");
            return { resultType: "continue", response: response };
          }),
        },
        {
          name: "hook2",
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook2");
            return { resultType: "continue", response: response };
          }),
        },
        {
          name: "hook3",
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
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
        processRequest: vi.fn(),
        processResponse: vi.fn().mockResolvedValue({
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
        processRequest: vi.fn(),
        processResponse: vi.fn().mockResolvedValue({
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
});
