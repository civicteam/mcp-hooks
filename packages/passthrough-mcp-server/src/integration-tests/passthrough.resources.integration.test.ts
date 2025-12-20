import { randomUUID } from "node:crypto";
import { createServer, type Server as HTTPServer } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  Hook,
  HookChainError,
  ListResourcesErrorHookResult,
  ListResourcesRequestHookResult,
  ListResourcesResponseHookResult,
  ListResourceTemplatesRequestHookResult,
  ListResourceTemplatesResponseHookResult,
  ReadResourceErrorHookResult,
  ReadResourceRequestHookResult,
  ReadResourceResponseHookResult,
  RequestExtra,
} from "@civic/hook-common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  type ListResourcesRequest,
  type ListResourcesResult,
  ListResourcesResultSchema,
  type ListResourceTemplatesRequest,
  type ListResourceTemplatesResult,
  ListResourceTemplatesResultSchema,
  McpError,
  type ReadResourceRequest,
  type ReadResourceResult,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PassthroughContext } from "../shared/passthroughContext.js";

describe("Passthrough Resources Hook Integration Tests", () => {
  let passthroughContext: PassthroughContext;
  let passthroughServerTransport: StreamableHTTPServerTransport;
  let passthroughClientTransport: StreamableHTTPClientTransport;
  let passthroughServer: HTTPServer;
  let passthroughServerUrl: URL;

  // Real MCP server with resources
  let realMcpServer: McpServer;
  let realMcpServerTransport: StreamableHTTPServerTransport;
  let realMcpHttpServer: HTTPServer;
  let realMcpServerUrl: URL;

  // Client
  let realClient: Client;
  let realClientTransport: StreamableHTTPClientTransport;

  beforeEach(async () => {
    // Create a real MCP server with resources
    realMcpServer = new McpServer(
      {
        name: "test-resource-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
        },
      },
    );

    // Add static resources
    realMcpServer.resource(
      "Configuration File",
      "file:///config.json",
      { mimeType: "application/json" },
      async () => {
        return {
          contents: [
            {
              uri: "file:///config.json",
              mimeType: "application/json",
              text: JSON.stringify({ version: "1.0", feature: "enabled" }),
            },
          ],
        };
      },
    );

    realMcpServer.resource(
      "Data File",
      "file:///data.txt",
      { mimeType: "text/plain" },
      async () => {
        return {
          contents: [
            {
              uri: "file:///data.txt",
              mimeType: "text/plain",
              text: "Sample data content",
            },
          ],
        };
      },
    );

    realMcpServer.resource(
      "Greeting Template",
      "template://greeting",
      { mimeType: "text/plain" },
      async () => {
        return {
          contents: [
            {
              uri: "template://greeting",
              mimeType: "text/plain",
              text: "Hello from template!",
            },
          ],
        };
      },
    );

    // Add resource templates
    realMcpServer.resource(
      "Dynamic Template",
      { uriTemplate: "template://{name}" },
      { mimeType: "text/plain" },
      async (args) => {
        const name = args.name as string;
        return {
          contents: [
            {
              uri: `template://${name}`,
              mimeType: "text/plain",
              text: `Dynamic content for ${name}`,
            },
          ],
        };
      },
    );

    realMcpServer.resource(
      "User Profile",
      { uriTemplate: "user://{id}/profile" },
      { mimeType: "application/json" },
      async (args) => {
        const userId = args.id as string;
        return {
          contents: [
            {
              uri: `user://${userId}/profile`,
              mimeType: "application/json",
              text: JSON.stringify({
                userId,
                name: `User ${userId}`,
                status: "active",
              }),
            },
          ],
        };
      },
    );

    // Set up real server transport
    realMcpServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await realMcpServer.connect(realMcpServerTransport);

    // Create HTTP server for real MCP server
    realMcpHttpServer = createServer();
    realMcpHttpServer.on("request", async (req, res) => {
      await realMcpServerTransport.handleRequest(req, res);
    });

    realMcpServerUrl = await new Promise<URL>((resolve) => {
      realMcpHttpServer.listen(0, "127.0.0.1", () => {
        const addr = realMcpHttpServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });

    // Set up passthrough server transport
    passthroughServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Set up passthrough client transport (to real server)
    passthroughClientTransport = new StreamableHTTPClientTransport(
      realMcpServerUrl,
    );

    // Create HTTP server for passthrough
    passthroughServer = createServer();
    passthroughServer.on("request", async (req, res) => {
      await passthroughServerTransport.handleRequest(req, res);
    });

    passthroughServerUrl = await new Promise<URL>((resolve) => {
      passthroughServer.listen(0, "127.0.0.1", () => {
        const addr = passthroughServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });

    // Set up real client
    realClient = new Client({
      name: "test-client",
      version: "1.0.0",
    });
    realClientTransport = new StreamableHTTPClientTransport(
      passthroughServerUrl,
    );
  });

  afterEach(async () => {
    try {
      await realClientTransport?.close();
    } catch (e) {
      console.warn("Error closing client transport:", e);
    }

    try {
      await passthroughContext?.close();
    } catch (e) {
      console.warn("Error closing passthrough context:", e);
    }

    passthroughServer?.close();
    realMcpHttpServer?.close();
  });

  describe("ListResources hooks", () => {
    it("should pass through resources/list without hooks", async () => {
      passthroughContext = new PassthroughContext();
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      expect(result.resources).toHaveLength(3);
      expect(result.resources[0].uri).toBe("file:///config.json");
      expect(result.resources[1].uri).toBe("file:///data.txt");
      expect(result.resources[2].uri).toBe("template://greeting");
    });

    it("should modify resources/list request through hook", async () => {
      const requestHook: Hook = {
        get name() {
          return "RequestModifierHook";
        },
        async processListResourcesRequest(
          request: ListResourcesRequest,
          _requestExtra: RequestExtra,
        ): Promise<ListResourcesRequestHookResult> {
          // Add a cursor to the request
          return {
            resultType: "continue",
            request: {
              ...request,
              params: {
                ...request.params,
                cursor: "modified-cursor",
              },
            },
          };
        },
      };

      // Pass hooks as local hooks, not remote
      passthroughContext = new PassthroughContext([requestHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      // Should still get resources (server ignores the cursor in our test)
      expect(result.resources).toHaveLength(3);
    });

    it("should modify resources/list response through hook", async () => {
      const responseHook: Hook = {
        get name() {
          return "ResponseModifierHook";
        },
        async processListResourcesResult(
          result: ListResourcesResult,
          _originalRequest: ListResourcesRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ListResourcesResponseHookResult> {
          // Filter out txt files
          return {
            resultType: "continue",
            response: {
              ...result,
              resources: result.resources.filter(
                (r) => !r.uri.endsWith(".txt"),
              ),
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([responseHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      expect(result.resources).toHaveLength(2);
      expect(
        result.resources.find((r) => r.uri.endsWith(".txt")),
      ).toBeUndefined();
    });

    it("should intercept resources/list and respond directly from hook", async () => {
      const interceptHook: Hook = {
        get name() {
          return "InterceptHook";
        },
        async processListResourcesRequest(
          _request: ListResourcesRequest,
          _requestExtra: RequestExtra,
        ): Promise<ListResourcesRequestHookResult> {
          // Respond directly without forwarding to server
          return {
            resultType: "respond",
            response: {
              resources: [
                {
                  uri: "hook://intercepted",
                  name: "Intercepted Resource",
                  mimeType: "text/plain",
                },
              ],
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([interceptHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].uri).toBe("hook://intercepted");
      expect(result.resources[0].name).toBe("Intercepted Resource");
    });

    it("should handle resources/list errors through hook", async () => {
      const errorHook: Hook = {
        get name() {
          return "ErrorHandlerHook";
        },
        async processListResourcesRequest(
          _request: ListResourcesRequest,
          _requestExtra: RequestExtra,
        ): Promise<ListResourcesRequestHookResult> {
          // Force an error
          throw new McpError(-32603, "Simulated error");
        },
        async processListResourcesError(
          _error: HookChainError,
          _originalRequest: ListResourcesRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ListResourcesErrorHookResult> {
          // Replace error with a successful response
          return {
            resultType: "respond",
            response: {
              resources: [
                {
                  uri: "error://recovered",
                  name: "Error Recovery Resource",
                  mimeType: "text/plain",
                },
              ],
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([errorHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].uri).toBe("error://recovered");
    });
  });

  describe("ListResourceTemplates hooks", () => {
    it("should pass through resources/templates/list without hooks", async () => {
      passthroughContext = new PassthroughContext();
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/templates/list", params: {} },
        ListResourceTemplatesResultSchema,
      );

      expect(result.resourceTemplates).toHaveLength(2);
      expect(result.resourceTemplates[0].uriTemplate).toBe("template://{name}");
      expect(result.resourceTemplates[1].uriTemplate).toBe(
        "user://{id}/profile",
      );
    });

    it("should modify resources/templates/list response through hook", async () => {
      const responseHook: Hook = {
        get name() {
          return "TemplateResponseHook";
        },
        async processListResourceTemplatesResult(
          result: ListResourceTemplatesResult,
          _originalRequest: ListResourceTemplatesRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ListResourceTemplatesResponseHookResult> {
          // Add an extra template
          return {
            resultType: "continue",
            response: {
              ...result,
              resourceTemplates: [
                ...result.resourceTemplates,
                {
                  uriTemplate: "hook://{added}",
                  name: "Hook-Added Template",
                  mimeType: "text/plain",
                },
              ],
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([responseHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/templates/list", params: {} },
        ListResourceTemplatesResultSchema,
      );

      expect(result.resourceTemplates).toHaveLength(3);
      expect(result.resourceTemplates[2].uriTemplate).toBe("hook://{added}");
    });

    it("should intercept resources/templates/list from hook", async () => {
      const interceptHook: Hook = {
        get name() {
          return "TemplateInterceptHook";
        },
        async processListResourceTemplatesRequest(
          _request: ListResourceTemplatesRequest,
          _requestExtra: RequestExtra,
        ): Promise<ListResourceTemplatesRequestHookResult> {
          return {
            resultType: "respond",
            response: {
              resourceTemplates: [
                {
                  uriTemplate: "custom://{type}/{id}",
                  name: "Custom Template",
                  mimeType: "application/json",
                },
              ],
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([interceptHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/templates/list", params: {} },
        ListResourceTemplatesResultSchema,
      );

      expect(result.resourceTemplates).toHaveLength(1);
      expect(result.resourceTemplates[0].uriTemplate).toBe(
        "custom://{type}/{id}",
      );
    });
  });

  describe("ReadResource hooks", () => {
    it("should pass through resources/read without hooks", async () => {
      passthroughContext = new PassthroughContext();
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "file:///config.json" } },
        ReadResourceResultSchema,
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("file:///config.json");
      expect(result.contents[0].text).toContain("version");
    });

    it("should modify resources/read request through hook", async () => {
      const requestHook: Hook = {
        get name() {
          return "ReadRequestHook";
        },
        async processReadResourceRequest(
          request: ReadResourceRequest,
          _requestExtra: RequestExtra,
        ): Promise<ReadResourceRequestHookResult> {
          // Redirect to a different resource
          if (request.params.uri === "redirect://config") {
            return {
              resultType: "continue",
              request: {
                ...request,
                params: {
                  ...request.params,
                  uri: "file:///config.json",
                },
              },
            };
          }
          return {
            resultType: "continue",
            request,
          };
        },
      };

      passthroughContext = new PassthroughContext([requestHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "redirect://config" } },
        ReadResourceResultSchema,
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("file:///config.json");
    });

    it("should modify resources/read response through hook", async () => {
      const responseHook: Hook = {
        get name() {
          return "ReadResponseHook";
        },
        async processReadResourceResult(
          result: ReadResourceResult,
          _originalRequest: ReadResourceRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ReadResourceResponseHookResult> {
          // Transform the content
          return {
            resultType: "continue",
            response: {
              ...result,
              contents: result.contents.map((c) => ({
                ...c,
                text: c.text ? `[MODIFIED] ${c.text}` : c.text,
              })),
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([responseHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "file:///data.txt" } },
        ReadResourceResultSchema,
      );

      expect(result.contents[0].text).toMatch(/^\[MODIFIED\]/);
      expect(result.contents[0].text).toContain("Sample data content");
    });

    it("should intercept resources/read and provide cached content", async () => {
      const cacheHook: Hook = {
        get name() {
          return "CacheHook";
        },
        async processReadResourceRequest(
          request: ReadResourceRequest,
          _requestExtra: RequestExtra,
        ): Promise<ReadResourceRequestHookResult> {
          if (request.params.uri === "cache://data") {
            return {
              resultType: "respond",
              response: {
                contents: [
                  {
                    uri: "cache://data",
                    mimeType: "text/plain",
                    text: "Cached content from hook",
                  },
                ],
              },
            };
          }
          return {
            resultType: "continue",
            request,
          };
        },
      };

      passthroughContext = new PassthroughContext([cacheHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "cache://data" } },
        ReadResourceResultSchema,
      );

      expect(result.contents[0].uri).toBe("cache://data");
      expect(result.contents[0].text).toBe("Cached content from hook");
    });

    it("should handle resources/read errors and provide fallback", async () => {
      const errorHook: Hook = {
        get name() {
          return "ReadErrorHook";
        },
        async processReadResourceError(
          error: HookChainError,
          originalRequest: ReadResourceRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ReadResourceErrorHookResult> {
          // Provide fallback content for missing resources
          if (error.message?.includes("not found")) {
            return {
              resultType: "respond",
              response: {
                contents: [
                  {
                    uri: originalRequest.params.uri,
                    mimeType: "text/plain",
                    text: "Fallback content for missing resource",
                  },
                ],
              },
            };
          }
          return {
            resultType: "continue",
          };
        },
      };

      passthroughContext = new PassthroughContext([errorHook]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "missing://resource" } },
        ReadResourceResultSchema,
      );

      expect(result.contents[0].text).toBe(
        "Fallback content for missing resource",
      );
    });

    it.skip("should read template resource with dynamic URI", async () => {
      passthroughContext = new PassthroughContext();
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "user://123/profile" } },
        ReadResourceResultSchema,
      );

      expect(result.contents[0].uri).toBe("user://123/profile");
      const text = result.contents[0].text;
      expect(text).toBeDefined();
      const content = JSON.parse(text ?? "{}");
      expect(content.userId).toBe("123");
      expect(content.name).toBe("User 123");
    });
  });

  describe("Multiple resource hooks chaining", () => {
    it("should chain multiple hooks for resources/list", async () => {
      const hook1: Hook = {
        get name() {
          return "Hook1";
        },
        async processListResourcesResult(
          result: ListResourcesResult,
          _originalRequest: ListResourcesRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ListResourcesResponseHookResult> {
          // Add a prefix to all resource names
          return {
            resultType: "continue",
            response: {
              ...result,
              resources: result.resources.map((r) => ({
                ...r,
                name: `[H1] ${r.name}`,
              })),
            },
          };
        },
      };

      const hook2: Hook = {
        get name() {
          return "Hook2";
        },
        async processListResourcesResult(
          result: ListResourcesResult,
          _originalRequest: ListResourcesRequest,
          _originalRequestExtra: RequestExtra,
        ): Promise<ListResourcesResponseHookResult> {
          // Add another prefix
          return {
            resultType: "continue",
            response: {
              ...result,
              resources: result.resources.map((r) => ({
                ...r,
                name: `[H2] ${r.name}`,
              })),
            },
          };
        },
      };

      passthroughContext = new PassthroughContext([hook1, hook2]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/list", params: {} },
        ListResourcesResultSchema,
      );

      // Both hooks should have processed the response in order (H1 then H2)
      expect(result.resources[0].name).toMatch(/^\[H1\] \[H2\]/);
    });

    it("should stop chain when hook responds directly", async () => {
      const hook1: Hook = {
        get name() {
          return "Hook1";
        },
        async processReadResourceRequest(
          request: ReadResourceRequest,
          _requestExtra: RequestExtra,
        ): Promise<ReadResourceRequestHookResult> {
          if (request.params.uri === "special://resource") {
            return {
              resultType: "respond",
              response: {
                contents: [
                  {
                    uri: "special://resource",
                    mimeType: "text/plain",
                    text: "Hook1 intercepted",
                  },
                ],
              },
            };
          }
          return {
            resultType: "continue",
            request,
          };
        },
      };

      const hook2: Hook = {
        get name() {
          return "Hook2";
        },
        async processReadResourceRequest(
          request: ReadResourceRequest,
          _requestExtra: RequestExtra,
        ): Promise<ReadResourceRequestHookResult> {
          // This should not be called for special://resource
          if (request.params.uri === "special://resource") {
            return {
              resultType: "respond",
              response: {
                contents: [
                  {
                    uri: "special://resource",
                    mimeType: "text/plain",
                    text: "Hook2 intercepted",
                  },
                ],
              },
            };
          }
          return {
            resultType: "continue",
            request,
          };
        },
      };

      passthroughContext = new PassthroughContext([hook1, hook2]);
      await passthroughContext.connect(
        passthroughServerTransport,
        passthroughClientTransport,
      );
      await realClient.connect(realClientTransport);

      const result = await realClient.request(
        { method: "resources/read", params: { uri: "special://resource" } },
        ReadResourceResultSchema,
      );

      // Hook1 should have intercepted, Hook2 should not have run
      expect(result.contents[0].text).toBe("Hook1 intercepted");
    });
  });
});
