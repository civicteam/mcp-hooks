/**
 * Tests for ServerHook
 */

import type { InitializeRequestWithContext } from "@civic/hook-common";
import type {
  Implementation,
  Notification,
} from "@modelcontextprotocol/sdk/types.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { ServerHook, type ServerHookConfig } from "./hook.js";

describe("ServerHook", () => {
  const mockServerInfo: Implementation = {
    name: "test-server",
    version: "1.0.0",
  };

  const createHook = (config?: Partial<ServerHookConfig>) => {
    return new ServerHook({
      serverInfo: mockServerInfo,
      ...config,
    });
  };

  describe("constructor", () => {
    it("should create hook with server info", () => {
      const hook = createHook();

      expect(hook.name).toBe("ServerHook");
      expect(hook.serverInfo).toEqual(mockServerInfo);
      expect(hook.options).toBeUndefined();
      expect(hook.isInitialized).toBe(false);
    });

    it("should create hook with options", () => {
      const options = { capabilities: { tools: { listChanged: true } } };
      const hook = createHook({ options });

      expect(hook.options).toEqual(options);
    });

    it("should create hook with callback", () => {
      const oninitialized = vi.fn();
      const hook = createHook({ oninitialized });

      expect(hook.oninitialized).toBe(oninitialized);
    });
  });

  describe("processInitializeRequest", () => {
    it("should process initialize request and respond", async () => {
      const hook = createHook();
      const request = {
        method: "initialize" as const,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        context: { source: "client" as const },
      };

      const result = await hook.processInitializeRequest(request);

      expect(result.resultType).toBe("respond");
      if (result.resultType === "respond") {
        expect(result.response.protocolVersion).toBe("2024-11-05");
        expect(result.response.serverInfo).toEqual(mockServerInfo);
        expect(result.response.capabilities).toEqual({});
        expect(result.response.instructions).toBeUndefined();
      }
      expect(hook.isInitialized).toBe(false); // Not initialized until notification

      // Verify client info and capabilities are stored
      expect(hook.getClientVersion()).toEqual({
        name: "test-client",
        version: "1.0.0",
      });
      expect(hook.getClientCapabilities()).toEqual({});
    });

    it("should throw McpError for unsupported protocol version", async () => {
      const hook = createHook();
      const request = {
        method: "initialize" as const,
        params: {
          protocolVersion: "unsupported-version",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        context: { source: "client" as const },
      };

      await expect(hook.processInitializeRequest(request)).rejects.toThrow(
        McpError,
      );
      await expect(hook.processInitializeRequest(request)).rejects.toThrow(
        "Unsupported protocol version: unsupported-version",
      );
    });

    it("should throw McpError for invalid protocol version format", async () => {
      const hook = createHook();
      const request = {
        method: "initialize" as const,
        params: {
          protocolVersion: "2023-01-01", // Assuming this is not supported
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        context: { source: "client" as const },
      };

      await expect(hook.processInitializeRequest(request)).rejects.toThrow(
        McpError,
      );
      await expect(hook.processInitializeRequest(request)).rejects.toThrow(
        "Unsupported protocol version: 2023-01-01",
      );
    });
  });

  describe("processNotification", () => {
    it("should handle initialized notification and call callback", async () => {
      const oninitialized = vi.fn();
      const hook = createHook({ oninitialized });

      const notification: Notification = {
        method: "notifications/initialized",
        params: {},
      };

      const result = await hook.processNotification(notification);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.notification).toBe(notification);
      }
      expect(hook.isInitialized).toBe(true);
      expect(oninitialized).toHaveBeenCalledOnce();
    });

    it("should handle initialized notification without callback", async () => {
      const hook = createHook();

      const notification: Notification = {
        method: "notifications/initialized",
        params: {},
      };

      const result = await hook.processNotification(notification);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.notification).toBe(notification);
      }
      expect(hook.isInitialized).toBe(true);
    });

    it("should handle callback errors gracefully", async () => {
      const oninitialized = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });
      const hook = createHook({ oninitialized });

      const notification: Notification = {
        method: "notifications/initialized",
        params: {},
      };

      // Should not throw despite callback error
      const result = await hook.processNotification(notification);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.notification).toBe(notification);
      }
      expect(hook.isInitialized).toBe(true);
      expect(oninitialized).toHaveBeenCalledOnce();
    });

    it("should handle other notifications without setting initialized", async () => {
      const oninitialized = vi.fn();
      const hook = createHook({ oninitialized });

      const notification: Notification = {
        method: "notifications/progress",
        params: { token: "test", value: 50 },
      };

      const result = await hook.processNotification(notification);

      expect(result.resultType).toBe("continue");
      if (result.resultType === "continue") {
        expect(result.notification).toBe(notification);
      }
      expect(hook.isInitialized).toBe(false);
      expect(oninitialized).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset initialization state and client data", async () => {
      const hook = createHook();

      // First, process an initialize request to store client data
      const request = {
        method: "initialize" as const,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        context: { source: "client" as const },
      };
      await hook.processInitializeRequest(
        request as InitializeRequestWithContext,
      );

      // Then set initialized state by processing an initialized notification
      const notification: Notification = {
        method: "notifications/initialized",
        params: {},
      };
      await hook.processNotification(notification);

      // Verify state before reset
      expect(hook.isInitialized).toBe(true);
      expect(hook.getClientVersion()).toEqual({
        name: "test-client",
        version: "1.0.0",
      });
      expect(hook.getClientCapabilities()).toEqual({});

      // Reset and verify everything is cleared
      hook.reset();
      expect(hook.isInitialized).toBe(false);
      expect(hook.getClientVersion()).toBeUndefined();
      expect(hook.getClientCapabilities()).toBeUndefined();
    });
  });

  describe("initialization flow", () => {
    it("should handle complete initialization flow", async () => {
      const oninitialized = vi.fn();
      const hook = createHook({ oninitialized });

      // Step 1: Initialize request
      const initRequest = {
        method: "initialize" as const,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        context: { source: "client" as const },
      };

      const initResult = await hook.processInitializeRequest(initRequest);
      expect(initResult.resultType).toBe("respond");
      expect(hook.isInitialized).toBe(false);
      expect(oninitialized).not.toHaveBeenCalled();

      // Step 2: Initialized notification
      const initializedNotification: Notification = {
        method: "notifications/initialized",
        params: {},
      };

      const notifResult = await hook.processNotification(
        initializedNotification,
      );
      expect(notifResult.resultType).toBe("continue");
      expect(hook.isInitialized).toBe(true);
      expect(oninitialized).toHaveBeenCalledOnce();
    });

    it("should handle multiple initialized notifications", async () => {
      const oninitialized = vi.fn();
      const hook = createHook({ oninitialized });

      const notification: Notification = {
        method: "notifications/initialized",
        params: {},
      };

      // First notification
      await hook.processNotification(notification);
      expect(hook.isInitialized).toBe(true);
      expect(oninitialized).toHaveBeenCalledTimes(1);

      // Second notification (should still call callback)
      await hook.processNotification(notification);
      expect(hook.isInitialized).toBe(true);
      expect(oninitialized).toHaveBeenCalledTimes(2);
    });
  });
});
