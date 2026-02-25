import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { PlaywrightTokenSaverHook } from "./hook.js";

const hook = new PlaywrightTokenSaverHook();

const toToolCall = (
  name: string,
  args: Record<string, unknown> = {},
  meta?: Record<string, unknown>,
): CallToolRequest => ({
  method: "tools/call",
  params: {
    name,
    arguments: args,
    ...(meta ? { _meta: meta } : {}),
  },
});

const toListToolsResult = (tools: Tool[]): ListToolsResult => ({ tools });

const browserRunCodeTool: Tool = {
  name: "browser_run_code",
  description: "Execute JavaScript code in the browser context",
  inputSchema: {
    type: "object",
    properties: { code: { type: "string" } },
    required: ["code"],
  },
};

const browserClickTool: Tool = {
  name: "browser_click",
  description: "Click an element on the page",
  inputSchema: {
    type: "object",
    properties: { selector: { type: "string" } },
    required: ["selector"],
  },
};

const nonBrowserTool: Tool = {
  name: "some_other_tool",
  description: "Not a browser tool",
  inputSchema: { type: "object", properties: {} },
};

describe("PlaywrightTokenSaverHook", () => {
  it("has a name", () => {
    expect(hook.name).toBe("PlaywrightTokenSaverHook");
  });

  describe("processListToolsResult", () => {
    it("injects run_code_cheap tool based on browser_run_code", async () => {
      const response = toListToolsResult([browserRunCodeTool, nonBrowserTool]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      expect(result.resultType).toBe("continue");
      const tools = result.response.tools;
      const cheapTool = tools.find((t) => t.name === "run_code_cheap");
      expect(cheapTool).toBeDefined();
      expect(cheapTool!.description).toContain("Token-saving wrapper");
      expect(cheapTool!.inputSchema).toEqual(browserRunCodeTool.inputSchema);
    });

    it("adds hint to browser_* tool descriptions", async () => {
      const response = toListToolsResult([
        browserRunCodeTool,
        browserClickTool,
      ]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      const clickTool = result.response.tools.find(
        (t) => t.name === "browser_click",
      );
      expect(clickTool!.description).toContain("prefer run_code_cheap");
    });

    it("does not add hint to non-browser tools", async () => {
      const response = toListToolsResult([browserRunCodeTool, nonBrowserTool]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      const other = result.response.tools.find(
        (t) => t.name === "some_other_tool",
      );
      expect(other!.description).toBe("Not a browser tool");
    });

    it("does not duplicate run_code_cheap if already present", async () => {
      const existingCheapTool: Tool = {
        name: "run_code_cheap",
        description: "Already exists",
        inputSchema: { type: "object", properties: {} },
      };
      const response = toListToolsResult([
        browserRunCodeTool,
        existingCheapTool,
      ]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      const cheapTools = result.response.tools.filter(
        (t) => t.name === "run_code_cheap",
      );
      expect(cheapTools).toHaveLength(1);
    });

    it("handles missing browser_run_code gracefully", async () => {
      const response = toListToolsResult([browserClickTool, nonBrowserTool]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      const cheapTool = result.response.tools.find(
        (t) => t.name === "run_code_cheap",
      );
      expect(cheapTool).toBeUndefined();
    });

    it("does not add duplicate hint to description that already has it", async () => {
      const toolWithHint: Tool = {
        ...browserClickTool,
        description: `Click an element on the page\n\nUse this only when you need full Playwright output. Otherwise prefer run_code_cheap to save tokens.`,
      };
      const response = toListToolsResult([browserRunCodeTool, toolWithHint]);
      const result = await hook.processListToolsResult(response, {
        method: "tools/list",
        params: {},
      });

      const clickTool = result.response.tools.find(
        (t) => t.name === "browser_click",
      );
      const hintCount = (
        clickTool!.description!.match(/prefer run_code_cheap/g) ?? []
      ).length;
      expect(hintCount).toBe(1);
    });
  });

  describe("processCallToolRequest", () => {
    it("passes through non-cheap tool calls unchanged", async () => {
      const request = toToolCall("browser_click", { selector: "#btn" });
      const result = await hook.processCallToolRequest(request);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.request.params.name).toBe("browser_click");
      }
    });

    it("rewrites run_code_cheap to browser_run_code with wrapped code", async () => {
      const request = toToolCall("run_code_cheap", {
        code: "async (page) => { return { success: true }; }",
      });
      const result = await hook.processCallToolRequest(request);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.request.params.name).toBe("browser_run_code");
        expect(result.request.params._meta).toMatchObject({
          run_code_cheap: true,
        });
        const code = result.request.params.arguments?.code as string;
        expect(code).toContain("__run_code_cheap_status");
        expect(code).toContain("__userFn");
      }
    });

    it("returns failure for missing code argument", async () => {
      const request = toToolCall("run_code_cheap", {});
      const result = await hook.processCallToolRequest(request);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response.isError).toBe(true);
      }
    });

    it("returns failure for non-string code argument", async () => {
      const request = toToolCall("run_code_cheap", { code: 42 });
      const result = await hook.processCallToolRequest(request);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response.isError).toBe(true);
      }
    });

    it("preserves existing _meta fields when marking as cheap", async () => {
      const request = toToolCall(
        "run_code_cheap",
        { code: "async (page) => ({ success: true })" },
        { existingField: "keep-me" },
      );
      const result = await hook.processCallToolRequest(request);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.request.params._meta).toMatchObject({
          existingField: "keep-me",
          run_code_cheap: true,
        });
      }
    });
  });

  describe("processCallToolResult", () => {
    const makeResponse = (text: string, isError = false): CallToolResult => ({
      isError,
      content: [{ type: "text", text }],
    });

    it("passes through non-cheap tool responses unchanged", async () => {
      const originalRequest = toToolCall("browser_click", { selector: "#btn" });
      const response = makeResponse("some large page snapshot...");
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.resultType).toBe("continue");
      expect(result.response).toBe(response);
    });

    it("compresses successful cheap call to status response", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const response = makeResponse(
        JSON.stringify({ __run_code_cheap_status: "success" }),
      );
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.resultType).toBe("continue");
      expect(result.response.isError).toBe(false);
      expect(result.response.content).toEqual([
        { type: "text", text: "success" },
      ]);
    });

    it("compresses failed cheap call to status response", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const response = makeResponse(
        JSON.stringify({ __run_code_cheap_status: "failure" }),
      );
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.resultType).toBe("continue");
      expect(result.response.isError).toBe(true);
      expect(result.response.content).toEqual([
        { type: "text", text: "failure" },
      ]);
    });

    it("detects success via success:true fallback pattern", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const response = makeResponse('Some output with {"success": true} in it');
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.response.isError).toBe(false);
    });

    it("treats error responses as failure", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const response = makeResponse("Error occurred", true);
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.response.isError).toBe(true);
    });

    it("treats unrecognized output as failure", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const response = makeResponse("Random page content with no status");
      const result = await hook.processCallToolResult(
        response,
        originalRequest,
      );

      expect(result.response.isError).toBe(true);
    });
  });

  describe("processCallToolError", () => {
    it("passes through errors for non-cheap tool calls", async () => {
      const originalRequest = toToolCall("browser_click", { selector: "#btn" });
      const error = { code: -32000, message: "Something failed" };
      const result = await hook.processCallToolError(error, originalRequest);

      expect(result.resultType).toBe("continue");
    });

    it("converts errors to failure status for cheap tool calls", async () => {
      const originalRequest = toToolCall(
        "browser_run_code",
        { code: "wrapped..." },
        { run_code_cheap: true },
      );
      const error = { code: -32000, message: "Something failed" };
      const result = await hook.processCallToolError(error, originalRequest);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response.isError).toBe(true);
        expect(result.response.content).toEqual([
          { type: "text", text: "failure" },
        ]);
      }
    });
  });
});
