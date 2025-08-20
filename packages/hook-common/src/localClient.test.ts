import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { AbstractHook } from "./AbstractHook.js";
import { LocalHookClient } from "./localClient.js";
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
});
