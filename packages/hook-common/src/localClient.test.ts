import type {
  CallToolRequest,
  CallToolResult,
  ListPromptsRequest,
  ListPromptsResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { AbstractHook } from "./AbstractHook.js";
import { LocalHookClient } from "./localClient.js";
import type {
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  HookChainError,
  ListPromptsErrorHookResult,
  ListPromptsRequestHookResult,
  ListPromptsResponseHookResult,
  ListToolsErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  RequestExtra,
} from "./types.js";

// Test helper for creating a mock RequestExtra
const mockRequestExtra: RequestExtra = {
  requestId: "test-request-id",
  sessionId: "test-session-id",
};

// Test hook that logs to an array
class TestLoggingHook extends AbstractHook {
  public logs: string[] = [];

  get name(): string {
    return "TestLoggingHook";
  }

  async processCallToolRequest(
    request: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    this.logs.push(`REQUEST: ${request.params.name}`);
    return {
      resultType: "continue",
      request: request,
    };
  }

  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    this.logs.push(`RESPONSE: ${originalCallToolRequest.params.name}`);
    return {
      resultType: "continue",
      response,
    };
  }
}

// Test hook that blocks certain operations
class TestValidationHook extends AbstractHook {
  get name(): string {
    return "TestValidationHook";
  }

  async processCallToolRequest(
    request: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    if (request.params.name.includes("dangerous")) {
      // Instead of returning abort, throw an error
      throw new Error("Dangerous operation blocked");
    }
    return {
      resultType: "continue",
      request,
    };
  }
}

describe("LocalHookClient", () => {
  it("should wrap a Hook instance and expose its name", () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    expect(client.name).toBe("TestLoggingHook");
  });

  it("should process requests through the hook", async () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    const request: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "fetch",
        arguments: { url: "https://example.com" },
      },
    };

    const response = await client.processCallToolRequest(
      request,
      mockRequestExtra,
    );

    expect(response.resultType).toBe("continue");
    expect((response as any).request).toEqual(request);
    expect(hook.logs).toContain("REQUEST: fetch");
  });

  it("should process responses through the hook", async () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    const request: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "fetch",
        arguments: { url: "https://example.com" },
      },
    };

    const toolResponse: CallToolResult = {
      content: [
        {
          type: "text",
          text: "test response",
        },
      ],
    };

    const response = await client.processCallToolResult(
      toolResponse,
      request,
      mockRequestExtra,
    );

    expect(response.resultType).toBe("continue");
    expect((response as any).response).toEqual(toolResponse);
    expect(hook.logs).toContain("RESPONSE: fetch");
  });

  it("should handle hook rejections", async () => {
    const hook = new TestValidationHook();
    const client = new LocalHookClient(hook);

    const request: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "dangerousOperation",
        arguments: {},
      },
    };

    // The client should propagate the error from the hook
    await expect(
      client.processCallToolRequest(request, mockRequestExtra),
    ).rejects.toThrow("Dangerous operation blocked");
  });

  it("should propagate hook errors", async () => {
    // Create a hook that throws an error
    class ErrorHook extends AbstractHook {
      get name(): string {
        return "ErrorHook";
      }

      async processCallToolRequest(
        request: CallToolRequest,
        requestExtra: RequestExtra,
      ): Promise<CallToolRequestHookResult> {
        throw new Error("Hook error");
      }
    }

    const hook = new ErrorHook();
    const client = new LocalHookClient(hook);

    const request: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "test",
        arguments: {},
      },
    };

    // Should propagate the error
    await expect(
      client.processCallToolRequest(request, mockRequestExtra),
    ).rejects.toThrow("Hook error");
  });

  describe("tools/list support", () => {
    it("should process tools/list requests through the hook", async () => {
      class ToolsListHook extends AbstractHook {
        get name(): string {
          return "ToolsListHook";
        }

        async processListToolsRequest(
          request: ListToolsRequest,
          requestExtra: RequestExtra,
        ): Promise<ListToolsRequestHookResult> {
          return {
            resultType: "continue",
            request,
          };
        }
      }

      const hook = new ToolsListHook();
      const client = new LocalHookClient(hook);

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const response = await client.processListToolsRequest(
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).request).toEqual(request);
    });

    it("should process tools/list responses through the hook", async () => {
      class ToolsListHook extends AbstractHook {
        get name(): string {
          return "ToolsListHook";
        }

        async processListToolsResult(
          response: ListToolsResult,
          originalRequest: ListToolsRequest,
          originalRequestExtra: RequestExtra,
        ): Promise<ListToolsResponseHookResult> {
          return {
            resultType: "continue",
            response,
          };
        }
      }

      const hook = new ToolsListHook();
      const client = new LocalHookClient(hook);

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const toolsResponse: ListToolsResult = {
        tools: [
          {
            name: "test-tool",
            description: "A test tool",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };

      const response = await client.processListToolsResult(
        toolsResponse,
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).response).toEqual(toolsResponse);
    });

    it("should handle tools/list error processing", async () => {
      class ToolsErrorHook extends AbstractHook {
        get name(): string {
          return "ToolsErrorHook";
        }

        async processListToolsError(
          error: HookChainError,
          originalRequest: ListToolsRequest,
          originalRequestExtra: RequestExtra,
        ): Promise<ListToolsErrorHookResult> {
          return {
            resultType: "continue",
          };
        }
      }

      const hook = new ToolsErrorHook();
      const client = new LocalHookClient(hook);

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const error: HookChainError = {
        code: -32001,
        message: "Test error",
      };

      const response = await client.processListToolsError(
        error,
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
    });

    it("should return continue when hook doesn't implement tools/list methods", async () => {
      const hook = new TestLoggingHook(); // Hook that doesn't implement ListTools methods
      const client = new LocalHookClient(hook);

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const response = await client.processListToolsRequest(
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).request).toEqual(request);
    });
  });

  describe("prompts/list support", () => {
    it("should process prompts/list requests through the hook", async () => {
      class PromptsListHook extends AbstractHook {
        get name(): string {
          return "PromptsListHook";
        }

        async processListPromptsRequest(
          request: ListPromptsRequest,
          requestExtra: RequestExtra,
        ): Promise<ListPromptsRequestHookResult> {
          return {
            resultType: "continue",
            request,
          };
        }
      }

      const hook = new PromptsListHook();
      const client = new LocalHookClient(hook);

      const request: ListPromptsRequest = {
        method: "prompts/list",
        params: {},
      };

      const response = await client.processListPromptsRequest(
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).request).toEqual(request);
    });

    it("should process prompts/list responses through the hook", async () => {
      class PromptsListHook extends AbstractHook {
        get name(): string {
          return "PromptsListHook";
        }

        async processListPromptsResult(
          response: ListPromptsResult,
          originalRequest: ListPromptsRequest,
          originalRequestExtra: RequestExtra,
        ): Promise<ListPromptsResponseHookResult> {
          return {
            resultType: "continue",
            response,
          };
        }
      }

      const hook = new PromptsListHook();
      const client = new LocalHookClient(hook);

      const request: ListPromptsRequest = {
        method: "prompts/list",
        params: {},
      };

      const promptsResponse: ListPromptsResult = {
        prompts: [
          {
            name: "test-prompt",
            description: "A test prompt",
          },
        ],
      };

      const response = await client.processListPromptsResult(
        promptsResponse,
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).response).toEqual(promptsResponse);
    });

    it("should handle prompts/list error processing", async () => {
      class PromptsErrorHook extends AbstractHook {
        get name(): string {
          return "PromptsErrorHook";
        }

        async processListPromptsError(
          error: HookChainError,
          originalRequest: ListPromptsRequest,
          originalRequestExtra: RequestExtra,
        ): Promise<ListPromptsErrorHookResult> {
          return {
            resultType: "continue",
          };
        }
      }

      const hook = new PromptsErrorHook();
      const client = new LocalHookClient(hook);

      const request: ListPromptsRequest = {
        method: "prompts/list",
        params: {},
      };

      const error: HookChainError = {
        code: -32001,
        message: "Test error",
      };

      const response = await client.processListPromptsError(
        error,
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
    });

    it("should return continue when hook doesn't implement prompts/list methods", async () => {
      const hook = new TestLoggingHook(); // Hook that doesn't implement ListPrompts methods
      const client = new LocalHookClient(hook);

      const request: ListPromptsRequest = {
        method: "prompts/list",
        params: {},
      };

      const response = await client.processListPromptsRequest(
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      expect((response as any).request).toEqual(request);
    });

    it("should allow hooks to modify prompts/list responses", async () => {
      class ModifyingPromptsHook extends AbstractHook {
        get name(): string {
          return "ModifyingPromptsHook";
        }

        async processListPromptsResult(
          response: ListPromptsResult,
          originalRequest: ListPromptsRequest,
          originalRequestExtra: RequestExtra,
        ): Promise<ListPromptsResponseHookResult> {
          // Add a custom prompt to the response
          const modifiedResponse = {
            ...response,
            prompts: [
              ...(response.prompts || []),
              {
                name: "hook-added-prompt",
                description: "Added by hook",
              },
            ],
          };
          return {
            resultType: "continue",
            response: modifiedResponse,
          };
        }
      }

      const hook = new ModifyingPromptsHook();
      const client = new LocalHookClient(hook);

      const request: ListPromptsRequest = {
        method: "prompts/list",
        params: {},
      };

      const promptsResponse: ListPromptsResult = {
        prompts: [
          {
            name: "original-prompt",
            description: "Original prompt",
          },
        ],
      };

      const response = await client.processListPromptsResult(
        promptsResponse,
        request,
        mockRequestExtra,
      );

      expect(response.resultType).toBe("continue");
      const modifiedResponse = (response as any).response;
      expect(modifiedResponse.prompts).toHaveLength(2);
      expect(modifiedResponse.prompts[0].name).toBe("original-prompt");
      expect(modifiedResponse.prompts[1].name).toBe("hook-added-prompt");
    });
  });
});
