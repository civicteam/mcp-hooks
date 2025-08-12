import {
  AbstractHook,
  LocalHookClient,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

// Test hook that logs to an array
class TestLoggingHook extends AbstractHook {
  public logs: string[] = [];

  get name(): string {
    return "TestLoggingHook";
  }

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    this.logs.push(`REQUEST: ${toolCall.params.name}`);
    return {
      resultType: "continue",
      request: toolCall,
    };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    this.logs.push(`RESPONSE: ${originalToolCall.params.name}`);
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

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    if (toolCall.params.name.includes("dangerous")) {
      return {
        resultType: "abort",
        reason: "Dangerous operation blocked",
      };
    }
    return {
      resultType: "continue",
      request: toolCall,
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

    const toolCall: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "fetch",
        arguments: { url: "https://example.com" },
      },
    };

    const response = await client.processToolCallRequest(toolCall);

    expect(response.resultType).toBe("continue");
    expect((response as any).request).toEqual(toolCall);
    expect(hook.logs).toContain("REQUEST: fetch");
  });

  it("should process responses through the hook", async () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    const toolCall: CallToolRequest = {
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

    const response = await client.processToolCallResponse(
      toolResponse,
      toolCall,
    );

    expect(response.resultType).toBe("continue");
    expect((response as any).response).toEqual(toolResponse);
    expect(hook.logs).toContain("RESPONSE: fetch");
  });

  it("should handle hook rejections", async () => {
    const hook = new TestValidationHook();
    const client = new LocalHookClient(hook);

    const toolCall: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "dangerousOperation",
        arguments: {},
      },
    };

    const response = await client.processToolCallRequest(toolCall);

    expect(response.resultType).toBe("abort");
    expect((response as any).reason).toBe("Dangerous operation blocked");
  });

  it("should handle hook errors gracefully", async () => {
    // Create a hook that throws an error
    class ErrorHook extends AbstractHook {
      get name(): string {
        return "ErrorHook";
      }

      async processToolCallRequest(): Promise<CallToolRequestHookResult> {
        throw new Error("Hook error");
      }
    }

    const hook = new ErrorHook();
    const client = new LocalHookClient(hook);

    const toolCall: CallToolRequest = {
      method: "tools/call",
      params: {
        name: "test",
        arguments: {},
      },
    };

    // Should return continue response on error
    const response = await client.processToolCallRequest(toolCall);

    expect(response.resultType).toBe("continue");
    expect((response as any).request).toEqual(toolCall);
  });
});
