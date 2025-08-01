import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CancelledNotificationSchema,
  type Notification,
  PingRequestSchema,
  ProgressNotificationSchema,
  type Request,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PassthroughBaseProtocol } from "./passthroughBaseProtocol.js";

// Create a concrete implementation for testing
class TestPassthroughProtocol extends PassthroughBaseProtocol<
  Request,
  Notification,
  Result
> {
  // Expose protected methods for testing
  public testAssertCapabilityForMethod(method: Request["method"]) {
    return this.assertCapabilityForMethod(method);
  }

  public testAssertNotificationCapability(method: Notification["method"]) {
    return this.assertNotificationCapability(method);
  }

  public testAssertRequestHandlerCapability(method: string) {
    return this.assertRequestHandlerCapability(method);
  }
}

describe("PassthroughBaseProtocol", () => {
  let mockRequestHandler: (request: Request) => Promise<Result>;
  let mockNotificationHandler: (notification: Notification) => Promise<void>;
  let protocol: TestPassthroughProtocol;
  let mockTransport: Transport;

  beforeEach(() => {
    mockRequestHandler = vi.fn();
    mockNotificationHandler = vi.fn();

    mockTransport = {
      start: vi.fn(),
      close: vi.fn(),
      send: vi.fn(),
      onclose: vi.fn(),
      onerror: vi.fn(),
      onmessage: vi.fn(),
    };

    protocol = new TestPassthroughProtocol(
      mockRequestHandler,
      mockNotificationHandler,
    );
  });

  describe("constructor", () => {
    it("should create instance with provided handlers", () => {
      expect(protocol).toBeInstanceOf(PassthroughBaseProtocol);
      expect(protocol.fallbackRequestHandler).toBe(mockRequestHandler);
      expect(protocol.fallbackNotificationHandler).toBe(
        mockNotificationHandler,
      );
    });

    it("should remove default notification handlers for cancelled and progress", () => {
      // Access private property to verify handlers were removed
      const protocolWithPrivate = protocol as any;
      const notificationHandlers =
        protocolWithPrivate._notificationHandlers as Map<string, any>;

      // Verify specific handlers are not present
      expect(
        notificationHandlers.has(
          CancelledNotificationSchema.shape.method.value,
        ),
      ).toBe(false);
      expect(
        notificationHandlers.has(ProgressNotificationSchema.shape.method.value),
      ).toBe(false);
    });

    it("should remove default request handler for ping", () => {
      // Access private property to verify handler was removed
      const protocolWithPrivate = protocol as any;
      const requestHandlers = protocolWithPrivate._requestHandlers as Map<
        string,
        any
      >;

      // Verify ping handler is not present
      expect(requestHandlers.has(PingRequestSchema.shape.method.value)).toBe(
        false,
      );
    });

    it("should have empty handler maps after removing default handlers", () => {
      // Access private properties to verify maps are empty
      const protocolWithPrivate = protocol as any;
      const notificationHandlers =
        protocolWithPrivate._notificationHandlers as Map<string, any>;
      const requestHandlers = protocolWithPrivate._requestHandlers as Map<
        string,
        any
      >;

      // Verify maps are completely empty (no default handlers remain)
      expect(notificationHandlers.size).toBe(0);
      expect(requestHandlers.size).toBe(0);
    });

    it("should accept optional protocol options", () => {
      const options = { enforceStrictCapabilities: false };
      const protocolWithOptions = new TestPassthroughProtocol(
        mockRequestHandler,
        mockNotificationHandler,
        options,
      );

      expect(protocolWithOptions).toBeInstanceOf(PassthroughBaseProtocol);
    });
  });

  describe("capability assertion methods", () => {
    it("should accept all methods in assertCapabilityForMethod", () => {
      // These should not throw any errors
      expect(() =>
        protocol.testAssertCapabilityForMethod("test/request" as any),
      ).not.toThrow();
      expect(() =>
        protocol.testAssertCapabilityForMethod("another/method" as any),
      ).not.toThrow();
    });

    it("should accept all notifications in assertNotificationCapability", () => {
      // These should not throw any errors
      expect(() =>
        protocol.testAssertNotificationCapability("test/notification" as any),
      ).not.toThrow();
      expect(() =>
        protocol.testAssertNotificationCapability(
          "another/notification" as any,
        ),
      ).not.toThrow();
    });

    it("should accept all request handlers in assertRequestHandlerCapability", () => {
      // These should not throw any errors
      expect(() =>
        protocol.testAssertRequestHandlerCapability("test/handler"),
      ).not.toThrow();
      expect(() =>
        protocol.testAssertRequestHandlerCapability("another/handler"),
      ).not.toThrow();
    });
  });

  describe("connect method", () => {
    it("should call parent connect method without sending initialize message", async () => {
      // Mock the parent connect method
      const parentConnectSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(protocol)),
        "connect",
      );
      parentConnectSpy.mockResolvedValue(undefined);

      await protocol.connect(mockTransport);

      expect(parentConnectSpy).toHaveBeenCalledWith(mockTransport);
      expect(parentConnectSpy).toHaveBeenCalledTimes(1);
    });

    it("should only accept transport parameter", async () => {
      const parentConnectSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(protocol)),
        "connect",
      );
      parentConnectSpy.mockResolvedValue(undefined);

      // The method should only accept transport, no options parameter
      await expect(protocol.connect(mockTransport)).resolves.not.toThrow();

      // Parent should be called with just the transport
      expect(parentConnectSpy).toHaveBeenCalledWith(mockTransport);
    });
  });

  describe("fallback handlers", () => {
    it("should use fallback request handler for unhandled requests", async () => {
      const testRequest: Request = {
        method: "test/method",
        params: { test: "data" },
      };

      const expectedResult: Result = {
        result: { success: true },
      };

      vi.mocked(mockRequestHandler).mockResolvedValue(expectedResult);

      // Simulate receiving a request that would trigger the fallback handler
      const result = await protocol.fallbackRequestHandler(testRequest);

      expect(mockRequestHandler).toHaveBeenCalledWith(testRequest);
      expect(result).toBe(expectedResult);
    });

    it("should use fallback notification handler for unhandled notifications", async () => {
      const testNotification: Notification = {
        method: "test/notification",
        params: { message: "test" },
      };

      vi.mocked(mockNotificationHandler).mockResolvedValue(undefined);

      // Simulate receiving a notification that would trigger the fallback handler
      await protocol.fallbackNotificationHandler(testNotification);

      expect(mockNotificationHandler).toHaveBeenCalledWith(testNotification);
    });
  });

  describe("inheritance behavior", () => {
    it("should properly extend Protocol class", () => {
      // Check that it has the expected Protocol methods/properties
      expect(typeof protocol.setRequestHandler).toBe("function");
      expect(typeof protocol.setNotificationHandler).toBe("function");
      expect(typeof protocol.request).toBe("function");
      expect(typeof protocol.notification).toBe("function");
      expect(typeof protocol.removeRequestHandler).toBe("function");
      expect(typeof protocol.removeNotificationHandler).toBe("function");
    });

    it("should allow removing request and notification handlers", () => {
      // Test that the remove methods exist and can be called without errors
      expect(() => protocol.removeRequestHandler("some/method")).not.toThrow();
      expect(() =>
        protocol.removeNotificationHandler("some/notification"),
      ).not.toThrow();
    });
  });
});
