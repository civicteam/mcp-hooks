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
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
} from "./types.js";

// Mock tRPC client
vi.mock("@trpc/client", () => ({
  createTRPCClient: vi.fn(() => ({
    processRequest: {
      mutate: vi.fn(),
    },
    processResponse: {
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
  let mockProcessRequest: ReturnType<typeof vi.fn>;
  let mockProcessResponse: ReturnType<typeof vi.fn>;
  let hookClient: RemoteHookClient;
  const config: RemoteHookConfig = {
    url: "http://localhost:3000",
    name: "test-hook",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock implementations
    mockProcessRequest = vi.fn();
    mockProcessResponse = vi.fn();

    // Mock the tRPC client creation
    const mockClient = {
      processRequest: { mutate: mockProcessRequest },
      processResponse: { mutate: mockProcessResponse },
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

  describe("processRequest", () => {
    it("should process tool call and return response", async () => {
      const toolCall: CallToolRequest = toToolCall({
        name: "test-tool",
        arguments: { key: "value" },
        toolDefinition: undefined,
      });

      const adaptedToolCall: CallToolRequest = {
        ...toolCall,
        params: {
          ...toolCall.params,
          _meta: {
            modified: true,
          },
        },
      };

      const expectedResponse: ToolCallRequestHookResult = {
        resultType: "continue",
        request: adaptedToolCall,
      };

      mockProcessRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(mockProcessRequest).toHaveBeenCalledWith(toolCall);
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

      const expectedResponse: ToolCallRequestHookResult = {
        resultType: "continue",
        request: toolCall,
      };

      mockProcessRequest.mockResolvedValue(expectedResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(mockProcessRequest).toHaveBeenCalledWith(toolCall);
      expect(result).toEqual(expectedResponse);
    });

    it("should handle abort responses", async () => {
      const toolCall = toToolCall({
        name: "dangerous-tool",
        arguments: {},
        toolDefinition: undefined,
      });

      const abortResponse: ToolCallRequestHookResult = {
        resultType: "abort",
        reason: "Tool not allowed",
      };

      mockProcessRequest.mockResolvedValue(abortResponse);

      const result = await hookClient.processRequest(toolCall);

      expect(result).toEqual(abortResponse);
    });

    it("should handle errors and return continue response", async () => {
      const toolCall = toToolCall({
        name: "test-tool",
        arguments: {},
        toolDefinition: undefined,
      });

      const error = new Error("Network error");
      mockProcessRequest.mockRejectedValue(error);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await hookClient.processRequest(toolCall);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Hook test-hook request processing failed:",
        error,
      );
      expect(result).toEqual({
        resultType: "continue",
        request: toolCall,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("processResponse", () => {
    it("should process response with original tool call", async () => {
      const originalToolCall: CallToolRequest = toToolCall({
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

      const expectedResponse: ToolCallResponseHookResult = {
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

      mockProcessResponse.mockResolvedValue(expectedResponse);

      const result = await hookClient.processResponse(
        toolResponse,
        originalToolCall,
      );

      expect(mockProcessResponse).toHaveBeenCalledWith({
        response: toolResponse,
        originalToolCall,
      });
      expect(result).toEqual(expectedResponse);
    });

    it("should handle various response types", async () => {
      const originalToolCall: CallToolRequest = toToolCall({
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
        const expectedResponse: ToolCallResponseHookResult = {
          resultType: "continue",
          response: response,
        };

        mockProcessResponse.mockResolvedValue(expectedResponse);

        const result = await hookClient.processResponse(
          response,
          originalToolCall,
        );

        expect((result as any).response).toEqual(response);
      }
    });

    it("should handle abort on response", async () => {
      const originalToolCall: CallToolRequest = toToolCall({
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

      const abortResponse: ToolCallResponseHookResult = {
        resultType: "abort",
        reason: "Sensitive data detected",
      };

      mockProcessResponse.mockResolvedValue(abortResponse);

      const result = await hookClient.processResponse(
        toolResponse,
        originalToolCall,
      );

      expect(result).toEqual(abortResponse);
    });

    it("should handle errors and return continue response", async () => {
      const originalToolCall: CallToolRequest = toToolCall({
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
      const error = new Error("Processing failed");

      mockProcessResponse.mockRejectedValue(error);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await hookClient.processResponse(
        toolResponse,
        originalToolCall,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Hook test-hook response processing failed:",
        error,
      );
      expect(result).toEqual({
        resultType: "continue",
        response: toolResponse,
      });

      consoleSpy.mockRestore();
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
      processRequest: { mutate: vi.fn() },
      processResponse: { mutate: vi.fn() },
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
