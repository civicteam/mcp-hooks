import type {
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { MetadataHelper } from "./metadataHelper.js";

describe("MetadataHelper", () => {
  describe("addMetadataToRequest", () => {
    it("should add metadata to request when enabled (default)", () => {
      const helper = new MetadataHelper();
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = helper.addMetadataToRequest(
        request,
        "target-123",
        "source-456",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.targetSessionId).toBe("target-123");
      expect(result.params._meta.sourceSessionId).toBe("source-456");
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
      expect(result.params.test).toBe(true);
    });

    it("should add metadata when explicitly enabled", () => {
      const helper = new MetadataHelper(true, true, true);
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = helper.addMetadataToRequest(
        request,
        "target-123",
        "source-456",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.targetSessionId).toBe("target-123");
      expect(result.params._meta.sourceSessionId).toBe("source-456");
    });

    it("should not add metadata when disabled", () => {
      const helper = new MetadataHelper(false, true, true);
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = helper.addMetadataToRequest(
        request,
        "target-123",
        "source-456",
      );

      expect(result).toBe(request);
      expect(result.params._meta).toBeUndefined();
      expect(result.params.test).toBe(true);
    });

    it("should preserve existing _meta when adding metadata", () => {
      const helper = new MetadataHelper();
      const request: Request = {
        method: "test/method",
        params: {
          test: true,
          _meta: {
            existingField: "existing-value",
          },
        },
      };

      const result = helper.addMetadataToRequest(
        request,
        "target-123",
        "source-456",
      );

      expect(result.params._meta.existingField).toBe("existing-value");
      expect(result.params._meta.targetSessionId).toBe("target-123");
      expect(result.params._meta.sourceSessionId).toBe("source-456");
    });

    it("should handle undefined session IDs", () => {
      const helper = new MetadataHelper();
      const request: Request = {
        method: "test/method",
        params: { test: true },
      };

      const result = helper.addMetadataToRequest(request, undefined, undefined);

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.targetSessionId).toBeUndefined();
      expect(result.params._meta.sourceSessionId).toBeUndefined();
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
    });
  });

  describe("addMetadataToResult", () => {
    it("should add metadata to result when enabled (default)", () => {
      const helper = new MetadataHelper();
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = helper.addMetadataToResult(
        response,
        "target-123",
        "source-456",
      );

      expect(result._meta).toBeDefined();
      expect(result._meta.targetSessionId).toBe("target-123");
      expect(result._meta.sourceSessionId).toBe("source-456");
      expect(result._meta.timestamp).toBeDefined();
      expect(result._meta.source).toBe("passthrough-server");
      expect(result.success).toBe(true);
    });

    it("should add metadata when explicitly enabled", () => {
      const helper = new MetadataHelper(true, true, true);
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = helper.addMetadataToResult(
        response,
        "target-123",
        "source-456",
      );

      expect(result._meta).toBeDefined();
      expect(result._meta.targetSessionId).toBe("target-123");
      expect(result._meta.sourceSessionId).toBe("source-456");
    });

    it("should not add metadata when disabled", () => {
      const helper = new MetadataHelper(true, false, true);
      const response: Result = {
        success: true,
        data: "test",
      };

      const result = helper.addMetadataToResult(
        response,
        "target-123",
        "source-456",
      );

      expect(result).toBe(response);
      expect(result._meta).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it("should preserve existing _meta when adding metadata", () => {
      const helper = new MetadataHelper();
      const response: Result = {
        success: true,
        _meta: {
          existingField: "existing-value",
        },
      };

      const result = helper.addMetadataToResult(
        response,
        "target-123",
        "source-456",
      );

      expect(result._meta.existingField).toBe("existing-value");
      expect(result._meta.targetSessionId).toBe("target-123");
      expect(result._meta.sourceSessionId).toBe("source-456");
    });
  });

  describe("addMetadataToNotification", () => {
    it("should add metadata to notification when enabled (default)", () => {
      const helper = new MetadataHelper();
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = helper.addMetadataToNotification(
        notification,
        "session-123",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.sessionId).toBe("session-123");
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
      expect(result.params.test).toBe(true);
    });

    it("should add metadata when explicitly enabled", () => {
      const helper = new MetadataHelper(true, true, true);
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = helper.addMetadataToNotification(
        notification,
        "session-123",
      );

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.sessionId).toBe("session-123");
    });

    it("should not add metadata when disabled", () => {
      const helper = new MetadataHelper(true, true, false);
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = helper.addMetadataToNotification(
        notification,
        "session-123",
      );

      expect(result).toBe(notification);
      expect(result.params._meta).toBeUndefined();
      expect(result.params.test).toBe(true);
    });

    it("should preserve existing _meta when adding metadata", () => {
      const helper = new MetadataHelper();
      const notification: Notification = {
        method: "test/notification",
        params: {
          test: true,
          _meta: {
            existingField: "existing-value",
          },
        },
      };

      const result = helper.addMetadataToNotification(
        notification,
        "session-123",
      );

      expect(result.params._meta.existingField).toBe("existing-value");
      expect(result.params._meta.sessionId).toBe("session-123");
    });

    it("should handle undefined session ID", () => {
      const helper = new MetadataHelper();
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const result = helper.addMetadataToNotification(notification, undefined);

      expect(result.params._meta).toBeDefined();
      expect(result.params._meta.sessionId).toBeUndefined();
      expect(result.params._meta.timestamp).toBeDefined();
      expect(result.params._meta.source).toBe("passthrough-server");
    });
  });

  describe("constructor options", () => {
    it("should respect individual option settings", () => {
      const helper = new MetadataHelper(false, true, false);

      const request: Request = {
        method: "test/method",
        params: { test: true },
      };
      const response: Result = {
        success: true,
      };
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const requestResult = helper.addMetadataToRequest(request, "t", "s");
      expect(requestResult.params._meta).toBeUndefined();

      const responseResult = helper.addMetadataToResult(response, "t", "s");
      expect(responseResult._meta).toBeDefined();

      const notificationResult = helper.addMetadataToNotification(
        notification,
        "s",
      );
      expect(notificationResult.params._meta).toBeUndefined();
    });

    it("should default all options to true when not specified", () => {
      const helper = new MetadataHelper();

      const request: Request = {
        method: "test/method",
        params: { test: true },
      };
      const response: Result = {
        success: true,
      };
      const notification: Notification = {
        method: "test/notification",
        params: { test: true },
      };

      const requestResult = helper.addMetadataToRequest(request, "t", "s");
      expect(requestResult.params._meta).toBeDefined();

      const responseResult = helper.addMetadataToResult(response, "t", "s");
      expect(responseResult._meta).toBeDefined();

      const notificationResult = helper.addMetadataToNotification(
        notification,
        "s",
      );
      expect(notificationResult.params._meta).toBeDefined();
    });
  });
});
