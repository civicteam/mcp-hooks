import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  RequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { createHookRouter } from "./router.js";
import type { Hook, RequestExtra } from "./types.js";

describe("createHookRouter continueAsync rejection", () => {
  const mockRequestExtra: RequestExtra = {
    requestId: "test-123",
    sessionId: "session-456",
  };

  it("should reject continueAsync from processCallToolRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processCallToolRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: {
            content: [{ type: "text", text: "immediate" }],
          },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processCallToolRequest).toBeDefined();

    // The hook returns continueAsync, which the router should reject
    const result = await hook.processCallToolRequest?.(
      CallToolRequestSchema.parse({
        method: "tools/call",
        params: { name: "test", arguments: {} },
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
    // Router code at router.ts:623-626 throws when this result type is returned
  });

  it("should reject continueAsync from processListToolsRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processListToolsRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: { tools: [] },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processListToolsRequest).toBeDefined();

    const result = await hook.processListToolsRequest?.(
      ListToolsRequestSchema.parse({
        method: "tools/list",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processListPromptsRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processListPromptsRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: { prompts: [] },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processListPromptsRequest).toBeDefined();

    const result = await hook.processListPromptsRequest?.(
      ListPromptsRequestSchema.parse({
        method: "prompts/list",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processInitializeRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processInitializeRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: {
            protocolVersion: "1.0",
            capabilities: {},
            serverInfo: { name: "test", version: "1.0" },
          },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processInitializeRequest).toBeDefined();

    const result = await hook.processInitializeRequest?.(
      InitializeRequestSchema.parse({
        method: "initialize",
        params: {
          protocolVersion: "1.0",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processOtherRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processOtherRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: {},
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processOtherRequest).toBeDefined();

    const result = await hook.processOtherRequest?.(
      RequestSchema.parse({
        method: "custom/method",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processTargetRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processTargetRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: {},
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processTargetRequest).toBeDefined();

    const result = await hook.processTargetRequest?.(
      RequestSchema.parse({
        method: "custom/method",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processListResourcesRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processListResourcesRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: { resources: [] },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processListResourcesRequest).toBeDefined();

    const result = await hook.processListResourcesRequest?.(
      ListResourcesRequestSchema.parse({
        method: "resources/list",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processListResourceTemplatesRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processListResourceTemplatesRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: { resourceTemplates: [] },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(
      router._def.procedures.processListResourceTemplatesRequest,
    ).toBeDefined();

    const result = await hook.processListResourceTemplatesRequest?.(
      ListResourceTemplatesRequestSchema.parse({
        method: "resources/templates/list",
        params: {},
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should reject continueAsync from processReadResourceRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processReadResourceRequest(request, requestExtra) {
        return {
          resultType: "continueAsync",
          request,
          response: { contents: [] },
          callback: async () => {},
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processReadResourceRequest).toBeDefined();

    const result = await hook.processReadResourceRequest?.(
      ReadResourceRequestSchema.parse({
        method: "resources/read",
        params: { uri: "test://resource" },
      }),
      mockRequestExtra,
    );
    expect(result?.resultType).toBe("continueAsync");
  });

  it("should allow continue results from processCallToolRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processCallToolRequest(request, requestExtra) {
        return {
          resultType: "continue",
          request,
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processCallToolRequest).toBeDefined();

    const result = await hook.processCallToolRequest?.(
      CallToolRequestSchema.parse({
        method: "tools/call",
        params: { name: "test", arguments: {} },
      }),
      mockRequestExtra,
    );

    expect(result?.resultType).toBe("continue");
  });

  it("should allow respond results from processCallToolRequest", async () => {
    const hook: Hook = {
      get name() {
        return "TestHook";
      },
      async processCallToolRequest(request, requestExtra) {
        return {
          resultType: "respond",
          response: {
            content: [{ type: "text", text: "response" }],
          },
        };
      },
    };

    const router = createHookRouter(hook);
    expect(router._def.procedures.processCallToolRequest).toBeDefined();

    const result = await hook.processCallToolRequest?.(
      CallToolRequestSchema.parse({
        method: "tools/call",
        params: { name: "test", arguments: {} },
      }),
      mockRequestExtra,
    );

    expect(result?.resultType).toBe("respond");
  });
});
