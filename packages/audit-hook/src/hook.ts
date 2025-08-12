/**
 * Audit Hook Implementation
 *
 * Implements the Hook interface for audit logging
 */

import type {
  Hook,
  CallToolRequestHookResult,
  CallToolResponseHookResult,
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
  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    const sessionId =
      (toolCall.params._meta as { sessionId?: string })?.sessionId || "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: toolCall.params.name,
      arguments:
        typeof toolCall.params.arguments === "object" &&
        toolCall.params.arguments !== null
          ? (toolCall.params.arguments as Record<string, unknown>)
          : { value: toolCall.params.arguments },
      metadata: {
        source: "request",
        transportType: "tRPC",
        ...toolCall.params._meta,
      },
    };

    // Log using the audit logger
    await this.auditLogger.log(auditEntry);

    // Always allow the request to proceed without modification
    return {
      resultType: "continue",
      request: toolCall,
    };
  }

  /**
   * Process a tool call response
   */
  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    const sessionId =
      (originalToolCall.params._meta as { sessionId?: string })?.sessionId ||
      "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: originalToolCall.params.name,
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
