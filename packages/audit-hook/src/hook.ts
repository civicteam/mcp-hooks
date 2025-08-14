/**
 * Audit Hook Implementation
 *
 * Implements the Hook interface for audit logging
 */

import type {
  CallToolRequestHookResult,
  CallToolResponseHookResult,
  Hook,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { AuditEntry, AuditLogger } from "./audit/types.js";

export class AuditHook implements Hook {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * The name of this hook
   */
  get name(): string {
    return "AuditHook";
  }

  /**
   * Process an incoming tool call request
   */
  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    const sessionId =
      (request.params._meta as { sessionId?: string })?.sessionId || "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: request.params.name,
      arguments:
        typeof request.params.arguments === "object" &&
        request.params.arguments !== null
          ? (request.params.arguments as Record<string, unknown>)
          : { value: request.params.arguments },
      metadata: {
        source: "request",
        transportType: "tRPC",
        ...request.params._meta,
      },
    };

    // Log using the audit logger
    await this.auditLogger.log(auditEntry);

    // Always allow the request to proceed without modification
    return {
      resultType: "continue",
      request,
    };
  }

  /**
   * Process a tool call response
   */
  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    const sessionId =
      (originalCallToolRequest.params._meta as { sessionId?: string })
        ?.sessionId || "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: originalCallToolRequest.params.name,
      arguments: {}, // No arguments for response
      response, // Include the full response data in dedicated field
      metadata: {
        source: "response",
        responseType: typeof response,
        hasResponse: response !== undefined,
        responseSize:
          typeof response === "object"
            ? JSON.stringify(response).length
            : String(response).length,
        transportType: "tRPC",
      },
    };

    // Log using the audit logger
    await this.auditLogger.log(auditEntry);

    // Always allow the response to proceed without modification
    return {
      resultType: "continue",
      response: response,
    };
  }
}
