import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Notification, Request } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { mapRequestHandlerExtraToRequestExtra } from "./requestExtraMapper.js";

describe("mapRequestHandlerExtraToRequestExtra", () => {
  it("should map all fields from RequestHandlerExtra to RequestExtra", () => {
    const mockRequestHandlerExtra: RequestHandlerExtra<Request, Notification> =
      {
        requestId: "test-request-id",
        sessionId: "test-session-id",
        authInfo: {
          access_token: "test-token",
          token_type: "Bearer",
        },
        _meta: {
          test: "metadata",
        },
        requestInfo: {
          url: "http://test.example.com",
          method: "POST",
          headers: { "content-type": "application/json" },
        },
        signal: new AbortController().signal,
        sendNotification: async () => {},
        sendRequest: async () => ({ result: {} }),
      };

    const result = mapRequestHandlerExtraToRequestExtra(
      mockRequestHandlerExtra,
    );

    expect(result).toEqual({
      requestId: "test-request-id",
      sessionId: "test-session-id",
      authInfo: {
        access_token: "test-token",
        token_type: "Bearer",
      },
      _meta: {
        test: "metadata",
      },
      requestInfo: {
        url: "http://test.example.com",
        method: "POST",
        headers: { "content-type": "application/json" },
      },
    });
  });

  it("should handle minimal RequestHandlerExtra with only required fields", () => {
    const mockRequestHandlerExtra: RequestHandlerExtra<Request, Notification> =
      {
        requestId: "test-request-id",
        signal: new AbortController().signal,
        sendNotification: async () => {},
        sendRequest: async () => ({ result: {} }),
      };

    const result = mapRequestHandlerExtraToRequestExtra(
      mockRequestHandlerExtra,
    );

    expect(result).toEqual({
      requestId: "test-request-id",
      sessionId: undefined,
      authInfo: undefined,
      _meta: undefined,
      requestInfo: undefined,
    });
  });

  it("should handle RequestHandlerExtra with partial optional fields", () => {
    const mockRequestHandlerExtra: RequestHandlerExtra<Request, Notification> =
      {
        requestId: "test-request-id",
        sessionId: "test-session-id",
        signal: new AbortController().signal,
        sendNotification: async () => {},
        sendRequest: async () => ({ result: {} }),
      };

    const result = mapRequestHandlerExtraToRequestExtra(
      mockRequestHandlerExtra,
    );

    expect(result).toEqual({
      requestId: "test-request-id",
      sessionId: "test-session-id",
      authInfo: undefined,
      _meta: undefined,
      requestInfo: undefined,
    });
  });

  it("should not include fields not present in RequestExtra", () => {
    const mockRequestHandlerExtra: RequestHandlerExtra<Request, Notification> =
      {
        requestId: "test-request-id",
        sessionId: "test-session-id",
        signal: new AbortController().signal,
        sendNotification: async () => {},
        sendRequest: async () => ({ result: {} }),
      };

    const result = mapRequestHandlerExtraToRequestExtra(
      mockRequestHandlerExtra,
    );

    // Verify that signal, sendNotification, and sendRequest are not included
    expect(result).not.toHaveProperty("signal");
    expect(result).not.toHaveProperty("sendNotification");
    expect(result).not.toHaveProperty("sendRequest");
  });

  it("should preserve complex authInfo structure", () => {
    const mockRequestHandlerExtra: RequestHandlerExtra<Request, Notification> =
      {
        requestId: "test-request-id",
        authInfo: {
          access_token: "complex-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-token",
          scope: "read write",
        },
        signal: new AbortController().signal,
        sendNotification: async () => {},
        sendRequest: async () => ({ result: {} }),
      };

    const result = mapRequestHandlerExtraToRequestExtra(
      mockRequestHandlerExtra,
    );

    expect(result.authInfo).toEqual({
      access_token: "complex-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-token",
      scope: "read write",
    });
  });
});
