/**
 * Tests for PassthroughContext source and target interfaces
 */

import {
  type CallToolRequest,
  type CallToolResult,
  type ListResourceTemplatesRequest,
  type ListResourceTemplatesResult,
  ListResourceTemplatesResultSchema,
  type ListResourcesRequest,
  type ListResourcesResult,
  ListResourcesResultSchema,
  McpError,
  type Notification,
  type ReadResourceRequest,
  type ReadResourceResult,
  ReadResourceResultSchema,
  type Request,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MCP_ERROR_CODES } from "../error/errorCodes.js";
import {
  PassthroughContext,
  type PassthroughContextOptions,
} from "./passthroughContext.js";

// Mock transports
const mockServerTransport = {
  sessionId: "test-server-session",
  send: vi.fn(),
  close: vi.fn(),
  start: vi.fn(),
};

const mockClientTransport = {
  sessionId: "test-client-session",
  send: vi.fn(),
  close: vi.fn(),
  start: vi.fn(),
};

// Mock schema for testing
const TestResultSchema = z.object({
  success: z.boolean(),
  data: z.string().optional(),
});

describe("PassthroughContext Source and Target Interfaces", () => {
  let context: PassthroughContext;

  beforeEach(() => {
    vi.clearAllMocks();
    context = new PassthroughContext();
  });

  describe("Source Interface", () => {
    describe("request method", () => {
      it("should throw McpError when no server transport is connected", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        await expect(
          context.source.request(testRequest, TestResultSchema),
        ).rejects.toThrow(McpError);

        await expect(
          context.source.request(testRequest, TestResultSchema),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No server transport connected"),
        });
      });

      it("should delegate to passthroughServer.request when transport is connected", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        const expectedResponse = { success: true, data: "test" };

        // Mock the server's request method
        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        // Connect transport
        await context.connect(mockServerTransport as any);

        const result = await context.source.request(
          testRequest,
          TestResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          TestResultSchema,
          undefined,
        );
        expect(result).toEqual(expectedResponse);
      });

      it("should pass through options to passthroughServer.request", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        const testOptions = { timeout: 5000 };
        const expectedResponse = { success: true };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        await context.source.request(
          testRequest,
          TestResultSchema,
          testOptions,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          TestResultSchema,
          testOptions,
        );
      });
    });

    describe("notification method", () => {
      it("should throw McpError when no server transport is connected", async () => {
        const testNotification: Notification = {
          method: "test/notification",
          params: { test: true },
        };

        await expect(
          context.source.notification(testNotification),
        ).rejects.toThrow(McpError);

        await expect(
          context.source.notification(testNotification),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No server transport connected"),
        });
      });

      it("should delegate to passthroughServer.notification when transport is connected", async () => {
        const testNotification: Notification = {
          method: "test/notification",
          params: { test: true },
        };

        const mockNotification = vi.fn().mockResolvedValue(undefined);
        (context as any)._passthroughServer.notification = mockNotification;

        await context.connect(mockServerTransport as any);

        await context.source.notification(testNotification);

        expect(mockNotification).toHaveBeenCalledWith(testNotification);
      });
    });

    describe("ping method", () => {
      it("should throw McpError when no server transport is connected", async () => {
        await expect(context.source.ping()).rejects.toThrow(McpError);

        await expect(context.source.ping()).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No server transport connected"),
        });
      });

      it("should delegate to passthroughServer.request with ping method when transport is connected", async () => {
        const expectedResponse = {};

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        const result = await context.source.ping();

        expect(mockRequest).toHaveBeenCalledWith(
          { method: "ping" },
          expect.anything(), // EmptyResultSchema
          undefined,
        );
        expect(result).toEqual(expectedResponse);
      });

      it("should pass through options to passthroughServer.request", async () => {
        const testOptions = { timeout: 5000 };
        const expectedResponse = {};

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        await context.source.ping(testOptions);

        expect(mockRequest).toHaveBeenCalledWith(
          { method: "ping" },
          expect.anything(), // EmptyResultSchema
          testOptions,
        );
      });
    });
  });

  describe("Target Interface", () => {
    describe("request method", () => {
      it("should throw McpError when no client transport is connected", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        // Connect only server transport
        await context.connect(mockServerTransport as any);

        await expect(
          context.target.request(testRequest, TestResultSchema),
        ).rejects.toThrow(McpError);

        await expect(
          context.target.request(testRequest, TestResultSchema),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No client transport connected"),
        });
      });

      it("should delegate to passthroughClient.request when transport is connected", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        const expectedResponse = { success: true, data: "client-test" };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughClient.request = mockRequest;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        const result = await context.target.request(
          testRequest,
          TestResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          TestResultSchema,
          undefined,
        );
        expect(result).toEqual(expectedResponse);
      });

      it("should pass through options to passthroughClient.request", async () => {
        const testRequest: Request = {
          method: "test/method",
          params: { test: true },
        };

        const testOptions = { timeout: 3000 };
        const expectedResponse = { success: false };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughClient.request = mockRequest;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        await context.target.request(
          testRequest,
          TestResultSchema,
          testOptions,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          TestResultSchema,
          testOptions,
        );
      });
    });

    describe("notification method", () => {
      it("should throw McpError when no client transport is connected", async () => {
        const testNotification: Notification = {
          method: "test/notification",
          params: { test: true },
        };

        // Connect only server transport
        await context.connect(mockServerTransport as any);

        await expect(
          context.target.notification(testNotification),
        ).rejects.toThrow(McpError);

        await expect(
          context.target.notification(testNotification),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No client transport connected"),
        });
      });

      it("should delegate to passthroughClient.notification when transport is connected", async () => {
        const testNotification: Notification = {
          method: "test/notification",
          params: { test: true },
        };

        const mockNotification = vi.fn().mockResolvedValue(undefined);
        (context as any)._passthroughClient.notification = mockNotification;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        await context.target.notification(testNotification);

        expect(mockNotification).toHaveBeenCalledWith(testNotification);
      });
    });

    describe("ping method", () => {
      it("should throw McpError when no client transport is connected", async () => {
        // Connect only server transport
        await context.connect(mockServerTransport as any);

        await expect(context.target.ping()).rejects.toThrow(McpError);

        await expect(context.target.ping()).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No client transport connected"),
        });
      });

      it("should delegate to passthroughClient.request with ping method when transport is connected", async () => {
        const expectedResponse = {};

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughClient.request = mockRequest;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        const result = await context.target.ping();

        expect(mockRequest).toHaveBeenCalledWith(
          { method: "ping" },
          expect.anything(), // EmptyResultSchema
          undefined,
        );
        expect(result).toEqual(expectedResponse);
      });

      it("should pass through options to passthroughClient.request", async () => {
        const testOptions = { timeout: 3000 };
        const expectedResponse = {};

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughClient.request = mockRequest;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        await context.target.ping(testOptions);

        expect(mockRequest).toHaveBeenCalledWith(
          { method: "ping" },
          expect.anything(), // EmptyResultSchema
          testOptions,
        );
      });
    });
  });

  describe("Interface Behavior", () => {
    it("should have separate source and target interface instances", () => {
      const source1 = context.source;
      const source2 = context.source;
      const target1 = context.target;
      const target2 = context.target;

      // Should return new instances each time (due to object literal)
      expect(source1).not.toBe(source2);
      expect(target1).not.toBe(target2);

      // But should have the same methods bound to the same context
      expect(source1.request).toBeDefined();
      expect(source1.notification).toBeDefined();
      expect(source1.ping).toBeDefined();
      expect(source1.transport).toBeDefined();
      expect(target1.request).toBeDefined();
      expect(target1.notification).toBeDefined();
      expect(target1.ping).toBeDefined();
      expect(target1.transport).toBeDefined();
    });

    it("should maintain method binding when destructured", async () => {
      const {
        request: sourceRequest,
        notification: sourceNotification,
        ping: sourcePing,
        transport: sourceTransport,
      } = context.source;
      const {
        request: targetRequest,
        notification: targetNotification,
        ping: targetPing,
        transport: targetTransport,
      } = context.target;

      const testRequest: Request = { method: "test", params: {} };
      const testNotification: Notification = { method: "test", params: {} };

      // These should throw McpErrors with proper error codes (proving binding is maintained)
      await expect(
        sourceRequest(testRequest, TestResultSchema),
      ).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });

      await expect(sourceNotification(testNotification)).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });

      await expect(sourcePing()).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });

      await expect(
        targetRequest(testRequest, TestResultSchema),
      ).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });

      await expect(targetNotification(testNotification)).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });

      await expect(targetPing()).rejects.toMatchObject({
        code: MCP_ERROR_CODES.REQUEST_REJECTED,
      });
    });
  });

  describe("Transport State Management", () => {
    it("should handle fresh context with no transports", async () => {
      const testRequest: Request = { method: "test", params: {} };
      const testNotification: Notification = { method: "test", params: {} };

      // Fresh context should not have any transports connected
      const freshContext = new PassthroughContext();

      // All methods should throw McpErrors
      await expect(
        freshContext.source.request(testRequest, TestResultSchema),
      ).rejects.toThrow(McpError);
      await expect(
        freshContext.source.notification(testNotification),
      ).rejects.toThrow(McpError);
      await expect(freshContext.source.ping()).rejects.toThrow(McpError);
      await expect(
        freshContext.target.request(testRequest, TestResultSchema),
      ).rejects.toThrow(McpError);
      await expect(
        freshContext.target.notification(testNotification),
      ).rejects.toThrow(McpError);
      await expect(freshContext.target.ping()).rejects.toThrow(McpError);
    });

    it("should work properly when transports are connected", async () => {
      const testRequest: Request = { method: "test", params: {} };
      const testNotification: Notification = { method: "test", params: {} };
      const expectedResponse = { success: true };

      // Setup mocks
      const mockServerRequest = vi.fn().mockResolvedValue(expectedResponse);
      const mockServerNotification = vi.fn().mockResolvedValue(undefined);
      const mockClientRequest = vi.fn().mockResolvedValue(expectedResponse);
      const mockClientNotification = vi.fn().mockResolvedValue(undefined);

      (context as any)._passthroughServer.request = mockServerRequest;
      (context as any)._passthroughServer.notification = mockServerNotification;
      (context as any)._passthroughClient.request = mockClientRequest;
      (context as any)._passthroughClient.notification = mockClientNotification;

      // Connect both transports
      await context.connect(
        mockServerTransport as any,
        mockClientTransport as any,
      );

      // Should work when connected
      await expect(
        context.source.request(testRequest, TestResultSchema),
      ).resolves.toEqual(expectedResponse);
      await expect(
        context.source.notification(testNotification),
      ).resolves.toBeUndefined();
      await expect(context.source.ping()).resolves.toEqual(expectedResponse);
      await expect(
        context.target.request(testRequest, TestResultSchema),
      ).resolves.toEqual(expectedResponse);
      await expect(
        context.target.notification(testNotification),
      ).resolves.toBeUndefined();
      await expect(context.target.ping()).resolves.toEqual(expectedResponse);

      // Verify the underlying methods were called
      expect(mockServerRequest).toHaveBeenCalledWith(
        testRequest,
        TestResultSchema,
        undefined,
      );
      expect(mockServerNotification).toHaveBeenCalledWith(testNotification);
      expect(mockClientRequest).toHaveBeenCalledWith(
        testRequest,
        TestResultSchema,
        undefined,
      );
      expect(mockClientNotification).toHaveBeenCalledWith(testNotification);
    });
  });

  describe("Transport Access", () => {
    it("should return undefined for transport when no transports are connected", () => {
      const context = new PassthroughContext();

      expect(context.source.transport()).toBeUndefined();
      expect(context.target.transport()).toBeUndefined();
    });

    it("should return server transport through source interface when connected", async () => {
      await context.connect(mockServerTransport as any);

      expect(context.source.transport()).toBe(mockServerTransport);
      expect(context.target.transport()).toBeUndefined(); // Client transport not connected
    });

    it("should return both transports when both are connected", async () => {
      await context.connect(
        mockServerTransport as any,
        mockClientTransport as any,
      );

      expect(context.source.transport()).toBe(mockServerTransport);
      expect(context.target.transport()).toBe(mockClientTransport);
    });

    it("should maintain transport binding when destructured", async () => {
      await context.connect(
        mockServerTransport as any,
        mockClientTransport as any,
      );

      const { transport: sourceTransport } = context.source;
      const { transport: targetTransport } = context.target;

      expect(sourceTransport()).toBe(mockServerTransport);
      expect(targetTransport()).toBe(mockClientTransport);
    });
  });

  describe("Resource Methods", () => {
    describe("listResources", () => {
      it("should throw McpError when no server transport is connected", async () => {
        const testRequest: ListResourcesRequest = {
          method: "resources/list",
          params: {},
        };

        await expect(
          context.source.request(testRequest, ListResourcesResultSchema),
        ).rejects.toThrow(McpError);

        await expect(
          context.source.request(testRequest, ListResourcesResultSchema),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No server transport connected"),
        });
      });

      it("should delegate to passthroughServer for resources/list", async () => {
        const testRequest: ListResourcesRequest = {
          method: "resources/list",
          params: { cursor: "test-cursor" },
        };

        const expectedResponse: ListResourcesResult = {
          resources: [
            {
              uri: "file:///test.txt",
              name: "Test File",
              mimeType: "text/plain",
            },
          ],
        };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        const result = await context.source.request(
          testRequest,
          ListResourcesResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          ListResourcesResultSchema,
          undefined,
        );
        expect(result).toEqual(expectedResponse);
        expect(result.resources).toHaveLength(1);
        expect(result.resources[0].uri).toBe("file:///test.txt");
      });
    });

    describe("listResourceTemplates", () => {
      it("should throw McpError when no server transport is connected", async () => {
        const testRequest: ListResourceTemplatesRequest = {
          method: "resources/templates/list",
          params: {},
        };

        await expect(
          context.source.request(
            testRequest,
            ListResourceTemplatesResultSchema,
          ),
        ).rejects.toThrow(McpError);
      });

      it("should delegate to passthroughServer for resources/templates/list", async () => {
        const testRequest: ListResourceTemplatesRequest = {
          method: "resources/templates/list",
          params: {},
        };

        const expectedResponse: ListResourceTemplatesResult = {
          resourceTemplates: [
            {
              uriTemplate: "template://{name}",
              name: "Dynamic Template",
              mimeType: "text/plain",
            },
          ],
        };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        const result = await context.source.request(
          testRequest,
          ListResourceTemplatesResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          ListResourceTemplatesResultSchema,
          undefined,
        );
        expect(result).toEqual(expectedResponse);
        expect(result.resourceTemplates).toHaveLength(1);
        expect(result.resourceTemplates[0].uriTemplate).toBe(
          "template://{name}",
        );
      });
    });

    describe("readResource", () => {
      it("should throw McpError when no server transport is connected", async () => {
        const testRequest: ReadResourceRequest = {
          method: "resources/read",
          params: { uri: "file:///test.txt" },
        };

        await expect(
          context.source.request(testRequest, ReadResourceResultSchema),
        ).rejects.toThrow(McpError);
      });

      it("should delegate to passthroughServer for resources/read", async () => {
        const testRequest: ReadResourceRequest = {
          method: "resources/read",
          params: { uri: "file:///test.txt" },
        };

        const expectedResponse: ReadResourceResult = {
          contents: [
            {
              uri: "file:///test.txt",
              mimeType: "text/plain",
              text: "Test content",
            },
          ],
        };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        const result = await context.source.request(
          testRequest,
          ReadResourceResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          ReadResourceResultSchema,
          undefined,
        );
        expect(result).toEqual(expectedResponse);
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].text).toBe("Test content");
      });

      it("should handle binary resources with blob data", async () => {
        const testRequest: ReadResourceRequest = {
          method: "resources/read",
          params: { uri: "file:///image.png" },
        };

        const expectedResponse: ReadResourceResult = {
          contents: [
            {
              uri: "file:///image.png",
              mimeType: "image/png",
              blob: "base64encodeddata",
            },
          ],
        };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        const result = await context.source.request(
          testRequest,
          ReadResourceResultSchema,
        );

        expect(result.contents[0].blob).toBe("base64encodeddata");
        expect(result.contents[0].text).toBeUndefined();
      });
    });

    describe("Target resource methods", () => {
      it("should delegate resources/list to target when client transport is connected", async () => {
        const testRequest: ListResourcesRequest = {
          method: "resources/list",
          params: {},
        };

        const expectedResponse: ListResourcesResult = {
          resources: [
            {
              uri: "target://resource",
              name: "Target Resource",
              mimeType: "text/plain",
            },
          ],
        };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughClient.request = mockRequest;

        await context.connect(
          mockServerTransport as any,
          mockClientTransport as any,
        );

        const result = await context.target.request(
          testRequest,
          ListResourcesResultSchema,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          ListResourcesResultSchema,
          undefined,
        );
        expect(result.resources[0].uri).toBe("target://resource");
      });

      it("should throw error for target resource methods when no client transport", async () => {
        await context.connect(mockServerTransport as any);

        const testRequest: ReadResourceRequest = {
          method: "resources/read",
          params: { uri: "file:///test.txt" },
        };

        await expect(
          context.target.request(testRequest, ReadResourceResultSchema),
        ).rejects.toMatchObject({
          code: MCP_ERROR_CODES.REQUEST_REJECTED,
          message: expect.stringContaining("No client transport connected"),
        });
      });
    });

    describe("Resource method options", () => {
      it("should pass through options for resource methods", async () => {
        const testRequest: ListResourcesRequest = {
          method: "resources/list",
          params: {},
        };

        const testOptions = { timeout: 10000 };
        const expectedResponse: ListResourcesResult = { resources: [] };

        const mockRequest = vi.fn().mockResolvedValue(expectedResponse);
        (context as any)._passthroughServer.request = mockRequest;

        await context.connect(mockServerTransport as any);

        await context.source.request(
          testRequest,
          ListResourcesResultSchema,
          testOptions,
        );

        expect(mockRequest).toHaveBeenCalledWith(
          testRequest,
          ListResourcesResultSchema,
          testOptions,
        );
      });
    });
  });
});

describe("PassthroughContext Metadata Options", () => {
  let context: PassthroughContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("appendMetadataToRequest option", () => {
    it("should add metadata to requests by default", async () => {
      context = new PassthroughContext();

      // Connect with mock transports
      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      // Access private method through any type
      const contextAny = context as any;
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = contextAny.addMetaToRequest(request);

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.targetSessionId).toBe("client-123");
      expect(result.params._meta.sourceSessionId).toBe("server-456");
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
    });

    it("should add metadata when appendMetadataToRequest is true", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToRequest: true,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = contextAny.addMetaToRequest(request);

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.targetSessionId).toBe("client-123");
      expect(result.params._meta.sourceSessionId).toBe("server-456");
    });

    it("should not add metadata when appendMetadataToRequest is false", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToRequest: false,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = contextAny.addMetaToRequest(request);

      expect(result.params._meta).toBeUndefined();
      expect(result.params.test).toBe(true);
    });
  });

  describe("appendMetadataToResponse option", () => {
    it("should add metadata to responses by default", async () => {
      context = new PassthroughContext();

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = contextAny.addMetaToResult(response);

      expect(result._meta).toBeDefined();
      expect(result._meta.targetSessionId).toBe("client-123");
      expect(result._meta.sourceSessionId).toBe("server-456");
      expect(result._meta.timestamp).toBeDefined();
      expect(result._meta.source).toBe("passthrough-server");
    });

    it("should add metadata when appendMetadataToResponse is true", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToResponse: true,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = contextAny.addMetaToResult(response);

      expect(result._meta).toBeDefined();
      expect(result._meta.targetSessionId).toBe("client-123");
      expect(result._meta.sourceSessionId).toBe("server-456");
    });

    it("should not add metadata when appendMetadataToResponse is false", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToResponse: false,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = contextAny.addMetaToResult(response);

      expect(result._meta).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.data).toBe("test");
    });
  });

  describe("appendMetadataToNotification option", () => {
    it("should add metadata to notifications by default", async () => {
      context = new PassthroughContext();

      await context.connect({
        ...mockServerTransport,
        sessionId: "server-456",
      } as any);

      const contextAny = context as any;
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = contextAny._metadataHelper.addMetadataToNotification(
        notification,
        "server-456",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.sessionId).toBe("server-456");
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
    });

    it("should add metadata when appendMetadataToNotification is true", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToNotification: true,
      };
      context = new PassthroughContext(undefined, options);

      const contextAny = context as any;
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = contextAny._metadataHelper.addMetadataToNotification(
        notification,
        "server-456",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.sessionId).toBe("server-456");
    });

    it("should not add metadata when appendMetadataToNotification is false", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToNotification: false,
      };
      context = new PassthroughContext(undefined, options);

      const contextAny = context as any;
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = contextAny._metadataHelper.addMetadataToNotification(
        notification,
        "server-456",
      );

      expect(result.params._meta).toBeUndefined();
      expect(result.params.test).toBe(true);
    });
  });

  describe("multiple options", () => {
    it("should respect all metadata options when set to false", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToRequest: false,
        appendMetadataToResponse: false,
        appendMetadataToNotification: false,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;

      // Test request
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };
      const requestResult = contextAny.addMetaToRequest(request);
      expect(requestResult.params._meta).toBeUndefined();

      // Test response
      const response: Result = {
        success: true,
        data: "test",
      };
      const responseResult = contextAny.addMetaToResult(response);
      expect(responseResult._meta).toBeUndefined();

      // Test notification
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };
      const notificationResult =
        contextAny._metadataHelper.addMetadataToNotification(
          notification,
          "server-456",
        );
      expect(notificationResult.params._meta).toBeUndefined();
    });

    it("should allow selective metadata addition", async () => {
      const options: PassthroughContextOptions = {
        appendMetadataToRequest: true,
        appendMetadataToResponse: false,
        appendMetadataToNotification: true,
      };
      context = new PassthroughContext(undefined, options);

      await context.connect(
        { ...mockServerTransport, sessionId: "server-456" } as any,
        { ...mockClientTransport, sessionId: "client-123" } as any,
      );

      const contextAny = context as any;

      // Test request - should have metadata
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };
      const requestResult = contextAny.addMetaToRequest(request);
      expect(requestResult.params._meta).toBeDefined();

      // Test response - should NOT have metadata
      const response: Result = {
        success: true,
        data: "test",
      };
      const responseResult = contextAny.addMetaToResult(response);
      expect(responseResult._meta).toBeUndefined();

      // Test notification - should have metadata
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };
      const notificationResult =
        contextAny._metadataHelper.addMetadataToNotification(
          notification,
          "server-456",
        );
      expect(notificationResult.params._meta).toBeDefined();
    });
  });
});

describe("PassthroughContext ContinueAsync Tests", () => {
  let context: PassthroughContext;
  let callbackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    callbackSpy = vi.fn();
  });

  describe("continueAsync in processServerRequest", () => {
    it("should return immediate response and invoke callback with final result", async () => {
      // Create hooks: first hook returns continueAsync, second hook processes normally
      const hook1 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          return {
            resultType: "continueAsync" as const,
            request,
            response: {
              content: [{ type: "text" as const, text: "Immediate response" }],
            },
            callback: callbackSpy,
          };
        },
      };

      const hook2 = {
        get name() {
          return "SecondHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          return {
            resultType: "respond" as const,
            request,
            response: {
              content: [
                { type: "text" as const, text: "Final response from hook2" },
              ],
            },
          };
        },
      };

      context = new PassthroughContext([hook1, hook2]);

      // Connect with only server transport (no client transport needed)
      await context.connect(mockServerTransport as any);

      // Access private method through any type
      const contextAny = context as any;
      const request: CallToolRequest = {
        method: "tools/call",
        params: { name: "test-tool", arguments: {} },
      };

      const requestExtra = {
        requestId: "test-123",
        sessionId: "session-456",
      };

      // Call processServerRequest
      const immediateResponse = await contextAny.processServerRequest(
        request,
        requestExtra,
        z.object({
          content: z.array(z.object({ type: z.string(), text: z.string() })),
        }),
        "processCallToolRequest",
        "processCallToolResult",
        "processCallToolError",
      );

      // Verify immediate response is returned
      expect(immediateResponse.content).toEqual([
        { type: "text", text: "Immediate response" },
      ]);

      // Wait for async callback to be invoked
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify callback was invoked with final result from hook2
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackError).toBeNull();
      expect(callbackResponse.content).toEqual([
        { type: "text", text: "Final response from hook2" },
      ]);
    });

    it("should invoke callback with error when async processing fails", async () => {
      const hook1 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          return {
            resultType: "continueAsync" as const,
            request,
            response: {
              content: [{ type: "text" as const, text: "Immediate response" }],
            },
            callback: callbackSpy,
          };
        },
      };

      const hook2 = {
        get name() {
          return "ErrorHook";
        },
        async processCallToolRequest() {
          throw new Error("Hook processing error");
        },
      };

      context = new PassthroughContext([hook1, hook2]);
      await context.connect(mockServerTransport as any);

      const contextAny = context as any;
      const request: CallToolRequest = {
        method: "tools/call",
        params: { name: "test-tool", arguments: {} },
      };

      const requestExtra = {
        requestId: "test-123",
        sessionId: "session-456",
      };

      // Call processServerRequest
      const immediateResponse = await contextAny.processServerRequest(
        request,
        requestExtra,
        z.object({
          content: z.array(z.object({ type: z.string(), text: z.string() })),
        }),
        "processCallToolRequest",
        "processCallToolResult",
        "processCallToolError",
      );

      // Verify immediate response is returned
      expect(immediateResponse.content).toEqual([
        { type: "text", text: "Immediate response" },
      ]);

      // Wait for async callback to be invoked
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify callback was invoked with error
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackResponse).toBeNull();
      expect(callbackError).toMatchObject({
        message: expect.stringContaining("Hook processing error"),
      });
    });

    it("should only process hooks after the continueAsync hook", async () => {
      const hook1Spy = vi.fn();
      const hook2Spy = vi.fn();
      const hook3Spy = vi.fn();

      const hook1 = {
        get name() {
          return "FirstHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          hook1Spy();
          return {
            resultType: "continue" as const,
            request,
          };
        },
      };

      const hook2 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          hook2Spy();
          return {
            resultType: "continueAsync" as const,
            request,
            response: {
              content: [{ type: "text" as const, text: "Immediate response" }],
            },
            callback: callbackSpy,
          };
        },
      };

      const hook3 = {
        get name() {
          return "ThirdHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          hook3Spy();
          return {
            resultType: "respond" as const,
            request,
            response: {
              content: [{ type: "text" as const, text: "Final response" }],
            },
          };
        },
      };

      context = new PassthroughContext([hook1, hook2, hook3]);
      await context.connect(mockServerTransport as any);

      const contextAny = context as any;
      const request: CallToolRequest = {
        method: "tools/call",
        params: { name: "test-tool", arguments: {} },
      };

      const requestExtra = {
        requestId: "test-123",
        sessionId: "session-456",
      };

      // Call processServerRequest
      await contextAny.processServerRequest(
        request,
        requestExtra,
        z.object({
          content: z.array(z.object({ type: z.string(), text: z.string() })),
        }),
        "processCallToolRequest",
        "processCallToolResult",
        "processCallToolError",
      );

      // Verify hook1 and hook2 were called in synchronous path
      expect(hook1Spy).toHaveBeenCalledOnce();
      expect(hook2Spy).toHaveBeenCalledOnce();

      // hook3 may have already been called (async processing can start immediately)
      // The key is that it was NOT called in the synchronous path above
      // We'll verify it was called exactly once total

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify hook3 was called exactly once (in async path)
      expect(hook3Spy).toHaveBeenCalledOnce();
    });
  });

  describe("continueAsync callback error handling", () => {
    it("should handle errors thrown by callback and report via onerror", async () => {
      const callbackError = new Error("Callback threw an error");
      const onerrorSpy = vi.fn();

      const hook1 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          return {
            resultType: "continueAsync" as const,
            request,
            response: {
              content: [{ type: "text" as const, text: "Immediate response" }],
            },
            callback: async () => {
              throw callbackError;
            },
          };
        },
      };

      const hook2 = {
        get name() {
          return "SecondHook";
        },
        async processCallToolRequest(request: CallToolRequest) {
          return {
            resultType: "respond" as const,
            request,
            response: {
              content: [
                { type: "text" as const, text: "Final response from hook2" },
              ],
            },
          };
        },
      };

      context = new PassthroughContext([hook1, hook2]);
      context.onerror = onerrorSpy;

      await context.connect(mockServerTransport as any);

      const contextAny = context as any;
      const request: CallToolRequest = {
        method: "tools/call",
        params: { name: "test-tool", arguments: {} },
      };

      const requestExtra = {
        requestId: "test-123",
        sessionId: "session-456",
      };

      // Call processServerRequest
      const immediateResponse = await contextAny.processServerRequest(
        request,
        requestExtra,
        z.object({
          content: z.array(z.object({ type: z.string(), text: z.string() })),
        }),
        "processCallToolRequest",
        "processCallToolResult",
        "processCallToolError",
      );

      // Verify immediate response is returned
      expect(immediateResponse.content).toEqual([
        { type: "text", text: "Immediate response" },
      ]);

      // Wait for async callback to be invoked
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify onerror was called with the callback error
      expect(onerrorSpy).toHaveBeenCalledOnce();
      expect(onerrorSpy).toHaveBeenCalledWith(callbackError);
    });
  });

  describe("continueAsync in processClientRequest", () => {
    it("should return immediate response and invoke callback with final result in reverse order", async () => {
      // In client request processing, hooks are processed in reverse (tail to head)
      const hook1 = {
        get name() {
          return "FirstHook";
        },
        async processTargetRequest(request: Request) {
          return {
            resultType: "respond" as const,
            request,
            response: {
              success: true,
              data: "Final response from hook1",
            },
          };
        },
      };

      const hook2 = {
        get name() {
          return "ContinueAsyncHook";
        },
        async processTargetRequest(request: Request) {
          return {
            resultType: "continueAsync" as const,
            request,
            response: {
              success: true,
              data: "Immediate response",
            },
            callback: callbackSpy,
          };
        },
      };

      context = new PassthroughContext([hook1, hook2]);
      await context.connect(mockServerTransport as any);

      const contextAny = context as any;
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const requestExtra = {
        requestId: "test-123",
        sessionId: "session-456",
      };

      // Call processClientRequest (processes in reverse: hook2 then hook1)
      const immediateResponse = await contextAny.processClientRequest(
        request,
        requestExtra,
        z.object({
          success: z.boolean(),
          data: z.string(),
        }),
        "processTargetRequest",
        "processTargetResult",
        "processTargetError",
      );

      // Verify immediate response is returned
      expect(immediateResponse.data).toBe("Immediate response");

      // Wait for async callback to be invoked
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify callback was invoked with final result from hook1
      expect(callbackSpy).toHaveBeenCalledOnce();
      const [callbackResponse, callbackError] = callbackSpy.mock.calls[0];
      expect(callbackError).toBeNull();
      expect(callbackResponse.data).toBe("Final response from hook1");
    });
  });
});
