import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RemoteHookClient,
  type RemoteHookConfig,
  createRemoteHookClients,
} from "./client.js";
import type {
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  RequestExtra,
} from "./types.js";

// Test helper for creating a mock RequestExtra
const mockRequestExtra: RequestExtra = {
  requestId: "test-request-id",
  sessionId: "test-session-id",
};

// Mock tRPC client
vi.mock("@trpc/client", () => ({
  createTRPCClient: vi.fn(() => ({
    processCallToolRequest: {
      mutate: vi.fn(),
    },
    processCallToolResult: {
      mutate: vi.fn(),
    },
  })),
  httpBatchLink: vi.fn(() => ({})),
}));

// Mock superjson
vi.mock("superjson", () => ({
  default: {
    serialize: vi.fn((val) => val),
    deserialize: vi.fn((val) => val),
  },
}));

const toToolCall = (params: CallToolRequest["params"]): CallToolRequest => ({
  params,
  method: "tools/call",
});

describe("RemoteHookClient", () => {
  let mockProcessCallToolRequest: ReturnType<typeof vi.fn>;
  let mockProcessCallToolResult: ReturnType<typeof vi.fn>;
  let hookClient: RemoteHookClient;
  const config: RemoteHookConfig = {
    url: "http://localhost:3000",
    name: "test-hook",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock implementations
    mockProcessCallToolRequest = vi.fn();
    mockProcessCallToolResult = vi.fn();

    // Mock the tRPC client creation
    const mockClient = {
      processCallToolRequest: { mutate: mockProcessCallToolRequest },
      processCallToolResult: { mutate: mockProcessCallToolResult },
    };

    (createTRPCClient as any).mockReturnValue(mockClient);

    hookClient = new RemoteHookClient(config);
  });

  describe("constructor", () => {
    it("should create hook client with config", () => {
      expect(hookClient.name).toBe("test-hook");
    });

    it("should initialize tRPC client with correct URL", async () => {
      expect(createTRPCClient).toHaveBeenCalled();
      expect(httpBatchLink).toHaveBeenCalledWith({
        url: "http://localhost:3000",
        transformer: expect.anything(),
      });
    });
  });

  describe("processCallToolRequest", () => {
    it("should process tool call and return response", async () => {
      const request: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: { key: "value" },
        toolDefinition: undefined,
      });

      const adaptedToolCall: CallToolRequest = {
        ...request,
        params: {
          ...request.params,
          _meta: {
            modified: true,
          },
        },
      };

      const expectedResponse: CallToolRequestHookResult = {
        resultType: "continue",
        request: adaptedToolCall,
      };

      mockProcessCallToolRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processCallToolRequest(
        request,
        mockRequestExtra,
      );

      expect(mockProcessCallToolRequest).toHaveBeenCalledWith({
        request,
        requestExtra: mockRequestExtra,
      });
      expect(result).toEqual(expectedResponse);
    });

    it("should handle tool calls with metadata", async () => {
      const toolCall = toToolCall({
        name: "test-tool",
        arguments: { key: "value" },
        toolDefinition: undefined,
        metadata: {
          sessionId: "session-123",
          timestamp: "2024-01-01T00:00:00Z",
          source: "test",
        },
      });

      const expectedResponse: CallToolRequestHookResult = {
        resultType: "continue",
        request: toolCall,
      };

      mockProcessCallToolRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processCallToolRequest(
        toolCall,
        mockRequestExtra,
      );

      expect(mockProcessCallToolRequest).toHaveBeenCalledWith({
        request: toolCall,
        requestExtra: mockRequestExtra,
      });
      expect(result).toEqual(expectedResponse);
    });

    it("should propagate exceptions from hooks", async () => {
      const toolCall = toToolCall({
        name: "dangerous-tool",
        arguments: {},
        toolDefinition: undefined,
      });

      const error = new Error("Tool not allowed");
      mockProcessCallToolRequest.mockRejectedValue(error);

      // The client should propagate errors from hooks
      await expect(
        hookClient.processCallToolRequest(toolCall, mockRequestExtra),
      ).rejects.toThrow("Tool not allowed");
    });

    it("should handle 'not implemented' errors and return continue response", async () => {
      const toolCall = toToolCall({
        name: "test-tool",
        arguments: {},
        toolDefinition: undefined,
      });

      const error = new Error("processCallToolRequest not implemented");
      mockProcessCallToolRequest.mockRejectedValue(error);

      const result = await hookClient.processCallToolRequest(
        toolCall,
        mockRequestExtra,
      );

      // Should silently continue for "not implemented" errors
      expect(result).toEqual({
        resultType: "continue",
        request: toolCall,
      });
    });
  });

  describe("processCallToolResult", () => {
    it("should process response with original tool call", async () => {
      const originalCallToolRequest: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: { key: "value" },
      });

      const toolResponse: CallToolResult = {
        content: [
          {
            type: "text",
            text: "response data",
          },
        ],
      };

      const expectedResponse: CallToolResponseHookResult = {
        resultType: "continue",
        response: {
          content: [
            {
              type: "text",
              text: "modified response",
            },
          ],
        },
      };

      mockProcessCallToolResult.mockResolvedValue(expectedResponse);

      const result = await hookClient.processCallToolResult(
        toolResponse,
        originalCallToolRequest,
        mockRequestExtra,
      );

      expect(mockProcessCallToolResult).toHaveBeenCalledWith({
        response: toolResponse,
        originalCallToolRequest,
        originalRequestExtra: mockRequestExtra,
      });
      expect(result).toEqual(expectedResponse);
    });

    it("should handle various response types", async () => {
      const originalCallToolRequest: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: {},
      });

      const testCases: CallToolResult[] = [
        {
          content: [{ type: "text", text: "string response" }],
        },
        {
          content: [{ type: "text", text: "123" }],
        },
        {
          content: [{ type: "text", text: "true" }],
        },
        {
          content: [
            { type: "text", text: JSON.stringify({ complex: "object" }) },
          ],
        },
        {
          content: [
            { type: "text", text: JSON.stringify(["array", "response"]) },
          ],
        },
      ];

      for (const response of testCases) {
        const expectedResponse: CallToolResponseHookResult = {
          resultType: "continue",
          response: response,
        };

        mockProcessCallToolResult.mockResolvedValue(expectedResponse);

        const result = await hookClient.processCallToolResult(
          response,
          originalCallToolRequest,
          mockRequestExtra,
        );

        expect((result as any).response).toEqual(response);
      }
    });

    it("should handle abort on response", async () => {
      const originalCallToolRequest: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: {},
      });

      const toolResponse: CallToolResult = {
        content: [
          {
            type: "text",
            text: "sensitive data",
          },
        ],
      };

      const error = new Error("Sensitive data detected");
      mockProcessCallToolResult.mockRejectedValue(error);

      // The client should propagate errors from hooks
      await expect(
        hookClient.processCallToolResult(
          toolResponse,
          originalCallToolRequest,
          mockRequestExtra,
        ),
      ).rejects.toThrow("Sensitive data detected");
    });

    it("should handle 'not implemented' errors and return continue response", async () => {
      const originalCallToolRequest: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: {},
      });

      const toolResponse: CallToolResult = {
        content: [
          {
            type: "text",
            text: "result data",
          },
        ],
      };
      const error = new Error("processCallToolResult not implemented");

      mockProcessCallToolResult.mockRejectedValue(error);

      const result = await hookClient.processCallToolResult(
        toolResponse,
        originalCallToolRequest,
        mockRequestExtra,
      );

      // Should silently continue for "not implemented" errors
      expect(result).toEqual({
        resultType: "continue",
        response: toolResponse,
      });
    });
  });
});

describe("createRemoteHookClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create multiple hook clients from configs", async () => {
    const configs: RemoteHookConfig[] = [
      { url: "http://localhost:3001", name: "hook1" },
      { url: "http://localhost:3002", name: "hook2" },
      { url: "http://localhost:3003", name: "hook3" },
    ];

    (createTRPCClient as any).mockReturnValue({
      processCallToolRequest: { mutate: vi.fn() },
      processCallToolResult: { mutate: vi.fn() },
    });

    const clients = createRemoteHookClients(configs);

    expect(clients).toHaveLength(3);
    expect(clients[0].name).toBe("hook1");
    expect(clients[1].name).toBe("hook2");
    expect(clients[2].name).toBe("hook3");
  });

  it("should create empty array for empty configs", () => {
    const clients = createRemoteHookClients([]);
    expect(clients).toEqual([]);
  });
});
