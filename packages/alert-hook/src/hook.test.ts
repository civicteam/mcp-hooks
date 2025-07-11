import type { TransportError } from "@civic/hook-common";
import type {
  CallToolRequest,
  ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlertHook } from "./index.js";

describe("AlertHook", () => {
  const mockToolCall: CallToolRequest = {
    method: "tools/call",
    params: {
      name: "test-tool",
      arguments: { test: "data" },
    },
  };

  const mockListToolsRequest: ListToolsRequest = {
    method: "tools/list",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("processToolCallTransportError", () => {
    it("should continue with error for 5xx error", async () => {
      const hook = new AlertHook({});
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
      };

      const result = await hook.processToolCallTransportError(
        error,
        mockToolCall,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });

    it("should continue with error for 503 error", async () => {
      const hook = new AlertHook({});
      const error: TransportError = {
        code: 503,
        message: "Service Unavailable",
      };

      const result = await hook.processToolCallTransportError(
        error,
        mockToolCall,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });

    it("should continue with error for 502 error", async () => {
      const hook = new AlertHook({});
      const error: TransportError = { code: 502, message: "Bad Gateway" };

      const result = await hook.processToolCallTransportError(
        error,
        mockToolCall,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });

    it("should continue with error for 4xx errors without alerting", async () => {
      const hook = new AlertHook({});
      const error: TransportError = { code: 404, message: "Not Found" };

      const result = await hook.processToolCallTransportError(
        error,
        mockToolCall,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });

    it("should send alert to webhook when configured", async () => {
      const webhookUrl = "https://example.com/webhook";
      const hook = new AlertHook({ webhookUrl });
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
      };

      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

      await hook.processToolCallTransportError(error, mockToolCall);

      expect(fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("tool_call_error"),
        }),
      );
    });

    it("should handle webhook errors gracefully", async () => {
      const webhookUrl = "https://example.com/webhook";
      const hook = new AlertHook({ webhookUrl });
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
      };

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      await hook.processToolCallTransportError(error, mockToolCall);

      expect(console.error).toHaveBeenCalledWith(
        "Error sending alert to webhook:",
        expect.any(Error),
      );
    });
  });

  describe("processToolsListTransportError", () => {
    it("should continue with error for 5xx error", async () => {
      const hook = new AlertHook({});
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
      };

      const result = await hook.processToolsListTransportError(
        error,
        mockListToolsRequest,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });

    it("should continue with error for non-5xx errors", async () => {
      const hook = new AlertHook({});
      const error: TransportError = { code: 400, message: "Bad Request" };

      const result = await hook.processToolsListTransportError(
        error,
        mockListToolsRequest,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });
  });

  describe("error formatting", () => {
    it("should handle complex errors with webhook", async () => {
      const webhookUrl = "https://example.com/webhook";
      const hook = new AlertHook({ webhookUrl });
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
        data: {
          originalCode: "ERR_INTERNAL",
          stack: "Error: Internal Server Error\n    at test.js:1:1",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

      await hook.processToolCallTransportError(error, mockToolCall);

      expect(fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringMatching(
            /"error":\s*{[^}]*"message":\s*"Internal Server Error"/,
          ),
        }),
      );
    });

    it("should handle errors without data", async () => {
      const hook = new AlertHook({});
      const error: TransportError = {
        code: 500,
        message: "Internal Server Error",
      };

      const result = await hook.processToolCallTransportError(
        error,
        mockToolCall,
      );

      expect(result).toEqual({
        resultType: "continue",
        error: error,
      });
    });
  });
});
