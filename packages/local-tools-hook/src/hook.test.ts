import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LocalToolsHook } from "./hook.js";
import type { ToolDefinition } from "./types.js";

const echoTool: ToolDefinition<{
  message: z.ZodString;
}> = {
  name: "echo",
  description: "Echoes back the input message",
  paramsSchema: {
    message: z.string(),
  },
  cb: async ({ message }) => ({
    content: [{ type: "text" as const, text: `Echo: ${message}` }],
  }),
};

const addTool: ToolDefinition<{
  a: z.ZodNumber;
  b: z.ZodNumber;
}> = {
  name: "add",
  description: "Adds two numbers",
  paramsSchema: {
    a: z.number(),
    b: z.number(),
  },
  cb: async ({ a, b }) => ({
    content: [{ type: "text" as const, text: `Result: ${a + b}` }],
  }),
};

const toToolCall = (params: CallToolRequest["params"]): CallToolRequest => ({
  params,
  method: "tools/call",
});

describe("LocalToolsHook", () => {
  // Define some test tools
  const testTools: ToolDefinition<any>[] = [echoTool, addTool];

  const hook = new LocalToolsHook(testTools);

  describe("processCallToolRequest", () => {
    it("should execute local tools and return 'respond'", async () => {
      const toolCall = toToolCall({
        name: "echo",
        arguments: { message: "Hello, World!" },
      });

      const result = await hook.processCallToolRequest(toolCall);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response).toEqual({
          content: [{ type: "text", text: "Echo: Hello, World!" }],
        });
      }
    });

    it("should handle numeric arguments correctly", async () => {
      const toolCall = toToolCall({
        name: "add",
        arguments: { a: 5, b: 3 },
      });

      const result = await hook.processCallToolRequest(toolCall);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response).toEqual({
          content: [{ type: "text", text: "Result: 8" }],
        });
      }
    });

    it("should return 'continue' for non-local tools", async () => {
      const toolCall = toToolCall({
        name: "remote-tool",
        arguments: { foo: "bar" },
      });

      const result = await hook.processCallToolRequest(toolCall);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.request).toEqual(toolCall);
      }
    });

    it("should handle tool execution errors with wrong arguments", async () => {
      const toolCall = toToolCall({
        name: "echo",
        arguments: { wrongArg: "test" }, // Missing required 'message' argument
      });

      const result = await hook.processCallToolRequest(toolCall);

      // The tool will be executed but may fail due to missing argument
      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        const content = result.response.content[0] as Extract<
          CallToolResult["content"][number],
          { type: "text" }
        >;
        expect(content.text).toContain("Echo: undefined");
      }
    });

    it("should handle tool execution errors", async () => {
      const errorTool: ToolDefinition<any> = {
        name: "error-tool",
        description: "Always throws an error",
        paramsSchema: {},
        cb: async () => {
          throw new Error("Tool execution failed");
        },
      };

      const hookWithError = new LocalToolsHook([errorTool]);
      const toolCall = toToolCall({
        name: "error-tool",
        arguments: {},
      });

      await expect(
        hookWithError.processCallToolRequest(toolCall),
      ).rejects.toThrow("Tool execution failed");
    });
  });

  describe("processCallToolResult", () => {
    it("should always return 'continue'", async () => {
      const response: CallToolResult = {
        content: [{ type: "text" as const, text: "test response" }],
      };
      const toolCall = toToolCall({
        name: "test",
        arguments: {},
      });

      const result = await hook.processCallToolResult(response, toolCall);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.response).toEqual(response);
      }
    });
  });

  describe("processListToolsResult", () => {
    it("should add local tools to the tools list", async () => {
      const remoteToolsList: ListToolsResult = {
        tools: [
          {
            name: "remote-tool",
            description: "A remote tool",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      };

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const result = await hook.processListToolsResult(
        remoteToolsList,
        request,
      );

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        const response = result.response;
        expect(response.tools).toHaveLength(3); // 1 remote + 2 local
        expect(response.tools.map((t) => t.name)).toContain("echo");
        expect(response.tools.map((t) => t.name)).toContain("add");
        expect(response.tools.map((t) => t.name)).toContain("remote-tool");
      }
    });

    it("should handle empty remote tools list", async () => {
      const remoteToolsList: ListToolsResult = {
        tools: [],
      };

      const request: ListToolsRequest = {
        method: "tools/list",
        params: {},
      };

      const result = await hook.processListToolsResult(
        remoteToolsList,
        request,
      );

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        const response = result.response;
        expect(response.tools).toHaveLength(2); // Only local tools
      }
    });
  });
});
