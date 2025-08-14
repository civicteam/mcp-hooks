/**
 * Tests for PassthroughContext source and target interfaces
 */

import {
  McpError,
  type Notification,
  type Request,
} from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MCP_ERROR_CODES } from "../error/errorCodes.js";
import { PassthroughContext } from "./passthroughContext.js";

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
});
