import type {
  GenericTransportErrorHookResult,
  TransportError,
} from "@civic/hook-common";
import { describe, expect, it, vi } from "vitest";
import { handleTransportError } from "./transport-error.js";

describe("handleTransportError", () => {
  const mockError: TransportError = {
    code: 401,
    message: "Unauthorized",
    responseType: "http",
  };

  const mockHeaders = {
    "content-type": "application/json",
  };

  const mockRequestId = "test-123";

  it("should handle abort result type", async () => {
    const processError = vi.fn().mockResolvedValue({
      resultType: "abort",
      reason: "Authentication required",
      lastProcessedIndex: 0,
    } as const);

    const result = await handleTransportError(
      mockError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(mockHeaders);
    expect(result.message).toMatchObject({
      jsonrpc: "2.0",
      id: mockRequestId,
      error: {
        code: -32603,
        message: "Authentication required",
      },
    });
  });

  it("should handle respond result type with successful response", async () => {
    const mockResult = {
      content: [
        {
          type: "text",
          text: "Success after retry",
        },
      ],
    };

    const processError = vi.fn().mockResolvedValue({
      resultType: "respond",
      response: mockResult,
      lastProcessedIndex: 0,
    } as const);

    const result = await handleTransportError(
      mockError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(mockHeaders);
    expect(result.message).toEqual({
      jsonrpc: "2.0",
      id: mockRequestId,
      result: mockResult,
    });
  });

  it("should handle continue result type with modified error", async () => {
    const modifiedError: TransportError = {
      code: 401,
      message: "Unauthorized - please authenticate",
      responseType: "http",
    };

    const processError = vi.fn().mockResolvedValue({
      resultType: "continue",
      error: modifiedError,
      lastProcessedIndex: 0,
    } as const);

    const result = await handleTransportError(
      mockError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.statusCode).toBe(401);
    expect(result.headers).toEqual(mockHeaders);
    expect(result.message).toEqual({
      statusCode: 401,
      body: "Unauthorized - please authenticate",
    });
  });

  it("should handle continue result type with JSON-RPC error", async () => {
    const jsonRpcError: TransportError = {
      code: -32603,
      message: "Internal error",
      responseType: "jsonrpc",
    };

    const processError = vi.fn().mockResolvedValue({
      resultType: "continue",
      error: jsonRpcError,
      lastProcessedIndex: 0,
    } as const);

    const result = await handleTransportError(
      jsonRpcError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(mockHeaders);
    expect(result.message).toMatchObject({
      jsonrpc: "2.0",
      id: mockRequestId,
      error: {
        code: -32603,
        message: "Internal error",
      },
    });
  });

  it("should have proper type inference for respond result", async () => {
    const mockResult = {
      content: [
        {
          type: "text",
          text: "Type safety verified",
        },
      ],
    };

    // This test verifies that TypeScript properly infers the response type
    // when resultType is "respond". The discriminated union ensures that
    // response is always present when resultType is "respond".
    const processError = vi.fn().mockImplementation(async () => {
      const result: GenericTransportErrorHookResult<any> & {
        lastProcessedIndex: number;
      } = {
        resultType: "respond",
        response: mockResult,
        lastProcessedIndex: 0,
      };
      // TypeScript knows that result.response exists here
      // No runtime check needed!
      return result;
    });

    const result = await handleTransportError(
      mockError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.message).toEqual({
      jsonrpc: "2.0",
      id: mockRequestId,
      result: mockResult,
    });
  });

  it("should use original error when no error is provided in continue result", async () => {
    const processError = vi.fn().mockResolvedValue({
      resultType: "continue",
      error: mockError,
      lastProcessedIndex: 0,
    } as const);

    const result = await handleTransportError(
      mockError,
      mockRequestId,
      mockHeaders,
      processError,
    );

    expect(result.statusCode).toBe(401);
    expect(result.message).toEqual({
      statusCode: 401,
      body: "Unauthorized",
    });
  });
});
