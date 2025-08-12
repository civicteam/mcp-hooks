import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  ClientResult,
  Notification,
  Request,
  ServerResult,
} from "@modelcontextprotocol/sdk/types.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassthroughClient } from "../client/passthroughClient.js";
import { createAbortException } from "../error/mcpErrorUtils.js";
import { HookChain } from "../hook/hookChain.js";
import * as processor from "../hook/processor.js";
import { PassthroughServer } from "../server/passthroughServer.js";
import { PassthroughContext } from "./passthroughContext.js";

vi.mock("../server/passthroughServer.js");
vi.mock("../client/passthroughClient.js");
vi.mock("../hook/hookChain.js");
vi.mock("../hook/processor.js");
vi.mock("../error/mcpErrorUtils.js");

describe("PassthroughContext", () => {
  let context: PassthroughContext;
  let mockServerTransport: Transport;
  let mockClientTransport: Transport;
  let mockPassthroughServer: any;
  let mockPassthroughClient: any;
  let mockHookChain: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServerTransport = {
      sessionId: "server-session-123",
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockClientTransport = {
      sessionId: "client-session-456",
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockPassthroughServer = {
      transport: mockServerTransport,
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      request: vi.fn(),
      notification: vi.fn().mockResolvedValue(undefined),
      setRequestHandler: vi.fn(),
      onclose: undefined,
    };

    mockPassthroughClient = {
      transport: mockClientTransport,
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      request: vi.fn(),
      notification: vi.fn().mockResolvedValue(undefined),
      onclose: undefined,
    };

    mockHookChain = {
      head: null,
      tail: null,
    };

    (PassthroughServer as any).mockImplementation(() => mockPassthroughServer);
    (PassthroughClient as any).mockImplementation(() => mockPassthroughClient);
    (HookChain as any).mockImplementation(() => mockHookChain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create PassthroughContext without hooks", () => {
      context = new PassthroughContext();

      expect(PassthroughServer).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
      expect(PassthroughClient).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
      expect(HookChain).toHaveBeenCalledWith(undefined);
    });

    it("should create PassthroughContext with hooks", () => {
      const hooks = [{ type: "local", path: "./hook.js" }];
      context = new PassthroughContext(hooks as any);

      expect(HookChain).toHaveBeenCalledWith(hooks);
    });

    it("should set up request handlers for Initialize, ListTools, and CallTool", () => {
      context = new PassthroughContext();

      expect(mockPassthroughServer.setRequestHandler).toHaveBeenCalledTimes(3);
      expect(mockPassthroughServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ parse: expect.any(Function) }),
        expect.any(Function),
      );
    });
  });

  describe("transport getters", () => {
    it("should return server transport", () => {
      context = new PassthroughContext();
      expect(context.passthroughServerTransport).toBe(mockServerTransport);
    });

    it("should return client transport", () => {
      context = new PassthroughContext();
      expect(context.passthroughClientTransport).toBe(mockClientTransport);
    });
  });

  describe("connect", () => {
    it("should connect both server and client transports", async () => {
      context = new PassthroughContext();
      await context.connect(mockServerTransport, mockClientTransport);

      expect(mockPassthroughServer.connect).toHaveBeenCalledWith(
        mockServerTransport,
      );
      expect(mockPassthroughClient.connect).toHaveBeenCalledWith(
        mockClientTransport,
      );
    });

    it("should connect only server transport when client transport is not provided", async () => {
      context = new PassthroughContext();
      await context.connect(mockServerTransport);

      expect(mockPassthroughServer.connect).toHaveBeenCalledWith(
        mockServerTransport,
      );
      expect(mockPassthroughClient.connect).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("should close both server and client", async () => {
      context = new PassthroughContext();
      await context.close();

      expect(mockPassthroughServer.close).toHaveBeenCalled();
      expect(mockPassthroughClient.close).toHaveBeenCalled();
    });
  });

  describe("request processing", () => {
    let processRequestThroughHooksMock: any;
    let processResponseThroughHooksMock: any;

    beforeEach(() => {
      processRequestThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        request: { method: "tool/call", params: {} },
        lastProcessedHook: null,
      });

      processResponseThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        response: { result: "success" },
      });

      (processor.processRequestThroughHooks as any) =
        processRequestThroughHooksMock;
      (processor.processResponseThroughHooks as any) =
        processResponseThroughHooksMock;

      mockPassthroughClient.request.mockResolvedValue({ result: "success" });
    });

    it("should process server request through hooks and forward to client", async () => {
      context = new PassthroughContext();

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test", arguments: {} },
      };

      const result = await callToolHandler(request);

      expect(processRequestThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "tools/call",
          params: expect.objectContaining({
            name: "test",
            arguments: {},
            _meta: expect.objectContaining({
              sessionId: "server-session-123",
              timestamp: expect.any(String),
              source: "passthrough-server",
            }),
          }),
        }),
        null,
        "processToolCallRequest",
      );

      expect(mockPassthroughClient.request).toHaveBeenCalled();
      expect(processResponseThroughHooksMock).toHaveBeenCalled();
      expect(result).toEqual({ result: "success" });
    });

    it("should throw error when client transport is not connected and request needs forwarding", async () => {
      context = new PassthroughContext();
      mockPassthroughClient.transport = undefined;

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      await expect(callToolHandler(request)).rejects.toThrow(
        new McpError(
          -32001,
          "No client transport connected. Cannot forward request to upstream server.",
        ),
      );
    });

    it("should handle request abort from hooks", async () => {
      context = new PassthroughContext();

      processRequestThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Request blocked",
      });

      const mockError = new McpError(-32001, "Request blocked");
      (createAbortException as any).mockReturnValue(mockError);

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      await expect(callToolHandler(request)).rejects.toThrow(mockError);
      expect(createAbortException).toHaveBeenCalledWith(
        "request",
        "Request blocked",
      );
    });

    it("should handle response abort from hooks", async () => {
      context = new PassthroughContext();

      processResponseThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Response blocked",
      });

      const mockError = new McpError(-32002, "Response blocked");
      (createAbortException as any).mockReturnValue(mockError);

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      await expect(callToolHandler(request)).rejects.toThrow(mockError);
      expect(createAbortException).toHaveBeenCalledWith(
        "response",
        "Response blocked",
      );
    });

    it("should use hook response when resultType is respond", async () => {
      context = new PassthroughContext();

      const hookResponse = { result: "hook-response" };
      processRequestThroughHooksMock.mockResolvedValue({
        resultType: "respond",
        response: hookResponse,
        lastProcessedHook: null,
      });

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      const result = await callToolHandler(request);

      expect(mockPassthroughClient.request).not.toHaveBeenCalled();
      expect(processResponseThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          result: "hook-response",
          _meta: expect.any(Object),
        }),
        expect.any(Object),
        null,
        "processToolCallResponse",
      );
    });
  });

  describe("notification handling", () => {
    let processNotificationThroughHooksMock: any;

    beforeEach(() => {
      processNotificationThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: { method: "notification/test", params: { data: "test" } },
      });

      (processor.processNotificationThroughHooks as any) =
        processNotificationThroughHooksMock;
    });

    it("should process notification through hooks and forward to client when connected", async () => {
      context = new PassthroughContext();

      const serverNotificationHandler = (PassthroughServer as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/test",
        params: { data: "test" },
      };

      await serverNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notification/test",
          params: expect.objectContaining({
            data: "test",
            _meta: expect.objectContaining({
              sessionId: "server-session-123",
              timestamp: expect.any(String),
              source: "passthrough-server",
            }),
          }),
        }),
        null,
        "processNotification",
      );

      expect(mockPassthroughClient.notification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notification/test",
          params: { data: "test" },
        }),
      );
    });

    it("should handle server notification when client is not connected", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;
      mockPassthroughClient.transport = undefined;

      const serverNotificationHandler = (PassthroughServer as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/test",
        params: { data: "test" },
      };

      await serverNotificationHandler(notification);

      expect(mockPassthroughClient.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "No client transport connected. Cannot forward notification to upstream server.",
        }),
      );
    });

    it("should handle notification abort from hooks", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      processNotificationThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Notification blocked by security hook",
      });

      const serverNotificationHandler = (PassthroughServer as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/test",
        params: { data: "test" },
      };

      await serverNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalled();
      expect(mockPassthroughClient.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Notification aborted by hook: Notification blocked by security hook",
        }),
      );
    });

    it("should handle notification processing errors gracefully", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      processNotificationThroughHooksMock.mockRejectedValue(
        new Error("Hook processing failed"),
      );

      const serverNotificationHandler = (PassthroughServer as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/test",
        params: { data: "test" },
      };

      await serverNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalled();
      expect(mockPassthroughClient.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Hook processing failed",
        }),
      );
    });

    it("should forward client notification to server", async () => {
      context = new PassthroughContext();

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/test",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      expect(mockPassthroughServer.notification).toHaveBeenCalledWith(
        notification,
      );
    });
  });

  describe("client notification handling", () => {
    let processNotificationThroughHooksMock: any;

    beforeEach(() => {
      processNotificationThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        notification: {
          method: "notification/target",
          params: { data: "test" },
        },
      });

      (processor.processNotificationThroughHooks as any) =
        processNotificationThroughHooksMock;
    });

    it("should process client notification through hooks in reverse order and forward to server", async () => {
      context = new PassthroughContext();

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notification/target",
          params: expect.objectContaining({
            data: "test",
            _meta: expect.objectContaining({
              sessionId: "server-session-123",
              timestamp: expect.any(String),
              source: "passthrough-server",
            }),
          }),
        }),
        null, // tail of hook chain (reverse processing)
        "processTargetNotification",
        "reverse",
      );

      expect(mockPassthroughServer.notification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notification/target",
          params: { data: "test" },
        }),
      );
    });

    it("should handle client notification when server is not connected", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;
      mockPassthroughServer.transport = undefined;

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      expect(mockPassthroughServer.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "No server transport connected. Cannot forward client notification to target server.",
        }),
      );
    });

    it("should handle client notification abort from hooks", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      processNotificationThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Client notification blocked by security hook",
      });

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalledWith(
        expect.any(Object),
        null,
        "processTargetNotification",
        "reverse",
      );
      expect(mockPassthroughServer.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Client notification aborted by hook: Client notification blocked by security hook",
        }),
      );
    });

    it("should handle client notification processing errors gracefully", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      processNotificationThroughHooksMock.mockRejectedValue(
        new Error("Client hook processing failed"),
      );

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      expect(processNotificationThroughHooksMock).toHaveBeenCalled();
      expect(mockPassthroughServer.notification).not.toHaveBeenCalled();
      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Client hook processing failed",
        }),
      );
    });

    it("should verify reverse direction processing for client notifications", async () => {
      context = new PassthroughContext();

      // Mock a scenario with multiple hooks to verify reverse processing
      const mockLastProcessedHook = {
        name: "test-hook",
        hook: {},
        next: null,
        previous: null,
      };
      mockHookChain.tail = mockLastProcessedHook;

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: { data: "test" },
      };

      await clientNotificationHandler(notification);

      // Verify that processNotificationThroughHooks was called with tail and reverse direction
      expect(processNotificationThroughHooksMock).toHaveBeenCalledWith(
        expect.any(Object), // annotated notification
        mockLastProcessedHook, // Should start from tail (reverse processing)
        "processTargetNotification", // Should use target notification method
        "reverse", // Should be reverse direction
      );
    });

    it("should properly annotate client notifications with metadata", async () => {
      context = new PassthroughContext();

      const clientNotificationHandler = (PassthroughClient as any).mock
        .calls[0][1];
      const notification: Notification = {
        method: "notification/target",
        params: {
          data: "test",
          _meta: { existingField: "value" },
        },
      };

      await clientNotificationHandler(notification);

      const processedNotification = (
        processor.processNotificationThroughHooks as any
      ).mock.calls[0][0];
      expect(processedNotification.params._meta).toMatchObject({
        existingField: "value", // Should preserve existing metadata
        sessionId: "server-session-123",
        timestamp: expect.any(String),
        source: "passthrough-server",
      });
    });
  });

  describe("client request handling", () => {
    let processRequestThroughHooksMock: any;
    let processResponseThroughHooksMock: any;

    beforeEach(() => {
      processRequestThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        request: { method: "prompt/get", params: { prompt: "test" } },
        lastProcessedHook: null,
      });

      processResponseThroughHooksMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        response: { result: "prompt-result" },
      });

      (processor.processRequestThroughHooks as any) =
        processRequestThroughHooksMock;
      (processor.processResponseThroughHooks as any) =
        processResponseThroughHooksMock;
    });

    it("should forward client request to server", async () => {
      context = new PassthroughContext();

      const clientRequestHandler = (PassthroughClient as any).mock.calls[0][0];
      const request: Request = {
        method: "prompt/get",
        params: { prompt: "test" },
      };
      const expectedResult: ClientResult = { result: "prompt-result" };

      mockPassthroughServer.request.mockResolvedValue(expectedResult);

      const result = await clientRequestHandler(request);

      expect(processRequestThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "prompt/get",
          params: expect.objectContaining({
            prompt: "test",
            _meta: expect.objectContaining({
              sessionId: "server-session-123",
              timestamp: expect.any(String),
              source: "passthrough-server",
            }),
          }),
        }),
        null, // tail of hook chain (reverse processing)
        "processTargetRequest",
        "reverse",
      );

      expect(mockPassthroughServer.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "prompt/get",
          params: { prompt: "test" },
        }),
        expect.any(Object),
      );
      expect(result).toEqual(expectedResult);
    });

    it("should process client request response with forward direction", async () => {
      context = new PassthroughContext();

      const clientRequestHandler = (PassthroughClient as any).mock.calls[0][0];
      const request: Request = {
        method: "prompt/get",
        params: { prompt: "test" },
      };
      const expectedResult: ClientResult = { result: "prompt-result" };

      mockPassthroughServer.request.mockResolvedValue(expectedResult);

      await clientRequestHandler(request);

      // Verify that processResponseThroughHooks was called with "forward" direction
      expect(processResponseThroughHooksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          result: "prompt-result",
          _meta: expect.objectContaining({
            sessionId: "client-session-456",
            timestamp: expect.any(String),
            source: "passthrough-server",
          }),
        }),
        expect.objectContaining({
          method: "prompt/get",
          params: expect.objectContaining({
            prompt: "test",
            _meta: expect.any(Object),
          }),
        }),
        null, // lastProcessedHook from request result
        "processTargetResponse",
        "forward", // This should be "forward" direction
      );
    });

    it("should handle different lastProcessedHook scenarios in client request response processing", async () => {
      context = new PassthroughContext();

      // Mock a scenario where request processing returns a specific lastProcessedHook
      const mockLastProcessedHook = {
        name: "test-hook",
        hook: {},
        next: null,
        previous: null,
      };
      processRequestThroughHooksMock.mockResolvedValue({
        resultType: "continue",
        request: { method: "prompt/get", params: { prompt: "test" } },
        lastProcessedHook: mockLastProcessedHook,
      });

      const clientRequestHandler = (PassthroughClient as any).mock.calls[0][0];
      const request: Request = {
        method: "prompt/get",
        params: { prompt: "test" },
      };
      const expectedResult: ClientResult = { result: "prompt-result" };

      mockPassthroughServer.request.mockResolvedValue(expectedResult);

      await clientRequestHandler(request);

      // Verify that processResponseThroughHooks was called with the specific lastProcessedHook
      expect(processResponseThroughHooksMock).toHaveBeenCalledWith(
        expect.any(Object), // annotated response
        expect.any(Object), // annotated request
        mockLastProcessedHook, // Should pass through the lastProcessedHook from request processing
        "processTargetResponse",
        "forward", // Should be "forward" direction
      );
    });

    it("should handle client request abort during request processing", async () => {
      context = new PassthroughContext();

      // Mock request processing to return abort
      processRequestThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Request blocked by security hook",
      });

      const mockError = new McpError(
        -32001,
        "Request blocked by security hook",
      );
      (createAbortException as any).mockReturnValue(mockError);

      const clientRequestHandler = (PassthroughClient as any).mock.calls[0][0];
      const request: Request = {
        method: "prompt/get",
        params: { prompt: "test" },
      };

      await expect(clientRequestHandler(request)).rejects.toThrow(mockError);

      // Verify server.request was not called due to abort
      expect(mockPassthroughServer.request).not.toHaveBeenCalled();
      // Verify response processing was not called due to abort
      expect(processResponseThroughHooksMock).not.toHaveBeenCalled();
    });

    it("should handle client request abort during response processing", async () => {
      context = new PassthroughContext();

      // Mock response processing to return abort
      processResponseThroughHooksMock.mockResolvedValue({
        resultType: "abort",
        reason: "Response blocked by filter hook",
      });

      const mockError = new McpError(-32002, "Response blocked by filter hook");
      (createAbortException as any).mockReturnValue(mockError);

      const clientRequestHandler = (PassthroughClient as any).mock.calls[0][0];
      const request: Request = {
        method: "prompt/get",
        params: { prompt: "test" },
      };
      const serverResponse = { result: "prompt-result" };

      mockPassthroughServer.request.mockResolvedValue(serverResponse);

      await expect(clientRequestHandler(request)).rejects.toThrow(mockError);

      // Verify server.request was called (request processing succeeded)
      expect(mockPassthroughServer.request).toHaveBeenCalled();
      // Verify response processing was called with forward direction
      expect(processResponseThroughHooksMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        null,
        "processTargetResponse",
        "forward",
      );
      // Verify createAbortException was called for response
      expect(createAbortException).toHaveBeenCalledWith(
        "response",
        "Response blocked by filter hook",
      );
    });
  });

  describe("connection lifecycle", () => {
    it("should close client when server closes", async () => {
      context = new PassthroughContext();

      const serverCloseHandler = mockPassthroughServer.onclose;
      await serverCloseHandler();

      expect(mockPassthroughClient.close).toHaveBeenCalled();
    });

    it("should close server when client closes", async () => {
      context = new PassthroughContext();

      const clientCloseHandler = mockPassthroughClient.onclose;
      await clientCloseHandler();

      expect(mockPassthroughServer.close).toHaveBeenCalled();
    });

    it("should handle error when closing client fails", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      mockPassthroughClient.close.mockRejectedValue(new Error("Close failed"));

      const serverCloseHandler = mockPassthroughServer.onclose;
      await serverCloseHandler();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            "Error trying to close the Passthrough Client",
          ),
        }),
      );
    });

    it("should handle error when closing server fails", async () => {
      context = new PassthroughContext();
      const onerrorSpy = vi.fn();
      context.onerror = onerrorSpy;

      mockPassthroughServer.close.mockRejectedValue(new Error("Close failed"));

      const clientCloseHandler = mockPassthroughClient.onclose;
      await clientCloseHandler();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onerrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            "Error trying to close the Passthrough Server",
          ),
        }),
      );
    });

    it("should call onclose callback when configured", async () => {
      context = new PassthroughContext();
      const oncloseSpy = vi.fn();
      context.onclose = oncloseSpy;

      await context.close();

      expect(mockPassthroughServer.close).toHaveBeenCalled();
      expect(mockPassthroughClient.close).toHaveBeenCalled();
    });
  });

  describe("special request handlers", () => {
    beforeEach(() => {
      const processRequestMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        request: { method: "initialize", params: {} },
        lastProcessedHook: null,
      });

      const processResponseMock = vi.fn().mockResolvedValue({
        resultType: "continue",
        response: { result: "initialized" },
      });

      (processor.processRequestThroughHooks as any) = processRequestMock;
      (processor.processResponseThroughHooks as any) = processResponseMock;

      mockPassthroughClient.request.mockResolvedValue({
        result: "initialized",
      });
    });

    it("should handle Initialize request with specific hook methods", async () => {
      context = new PassthroughContext();

      const initializeHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[0][1];
      const request = { method: "initialize", params: { clientInfo: {} } };

      await initializeHandler(request);

      expect(processor.processRequestThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        null,
        "processInitializeRequest",
      );

      expect(processor.processResponseThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        null,
        "processInitializeResponse",
      );
    });

    it("should handle ListTools request with specific hook methods", async () => {
      context = new PassthroughContext();

      const listToolsHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[1][1];
      const request = { method: "tools/list", params: {} };

      await listToolsHandler(request);

      expect(processor.processRequestThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        null,
        "processToolsListRequest",
      );

      expect(processor.processResponseThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        null,
        "processToolsListResponse",
      );
    });

    it("should handle CallTool request with specific hook methods", async () => {
      context = new PassthroughContext();

      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request = { method: "tools/call", params: { name: "test" } };

      await callToolHandler(request);

      expect(processor.processRequestThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        null,
        "processToolCallRequest",
      );

      expect(processor.processResponseThroughHooks).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        null,
        "processToolCallResponse",
      );
    });
  });

  describe("metadata annotation", () => {
    beforeEach(() => {
      const processRequestMock = vi.fn().mockImplementation((request) => ({
        resultType: "continue",
        request,
        lastProcessedHook: null,
      }));

      const processResponseMock = vi.fn().mockImplementation((response) => ({
        resultType: "continue",
        response,
      }));

      (processor.processRequestThroughHooks as any) = processRequestMock;
      (processor.processResponseThroughHooks as any) = processResponseMock;

      mockPassthroughClient.request.mockResolvedValue({ result: "success" });
    });

    it("should add metadata to request", async () => {
      context = new PassthroughContext();

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      await callToolHandler(request);

      const processedRequest = (processor.processRequestThroughHooks as any)
        .mock.calls[0][0];
      expect(processedRequest.params._meta).toMatchObject({
        sessionId: "server-session-123",
        timestamp: expect.any(String),
        source: "passthrough-server",
      });
    });

    it("should add metadata to response", async () => {
      context = new PassthroughContext();

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: { name: "test" },
      };

      await callToolHandler(request);

      const processedResponse = (processor.processResponseThroughHooks as any)
        .mock.calls[0][0];
      expect(processedResponse._meta).toMatchObject({
        sessionId: "client-session-456",
        timestamp: expect.any(String),
        source: "passthrough-server",
      });
    });

    it("should preserve existing metadata when adding new metadata", async () => {
      context = new PassthroughContext();

      // Get the CallTool handler (third registered handler)
      const callToolHandler =
        mockPassthroughServer.setRequestHandler.mock.calls[2][1];
      const request: Request = {
        method: "tools/call",
        params: {
          name: "test",
          _meta: { existingField: "value" },
        },
      };

      await callToolHandler(request);

      const processedRequest = (processor.processRequestThroughHooks as any)
        .mock.calls[0][0];
      expect(processedRequest.params._meta).toMatchObject({
        existingField: "value",
        sessionId: "server-session-123",
        timestamp: expect.any(String),
        source: "passthrough-server",
      });
    });
  });
});
