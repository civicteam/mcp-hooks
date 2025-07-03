import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/passthrough-mcp-server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Hook that reads the session ID from metadata and adds it to the response
 */
export class ReadSessionIdHook extends AbstractHook {
  get name(): string {
    return "ReadSessionIdHook";
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    const callToolResult = response as CallToolResult;

    // Get session ID from metadata
    const sessionId = originalToolCall.metadata?.sessionId;

    // Add session ID to the response
    if (response && typeof response === "object" && "content" in response) {
      const modifiedResponse = {
        ...callToolResult,
        content: [
          ...callToolResult.content,
          {
            type: "text",
            text: sessionId
              ? `[Hook: Session ID is ${sessionId}]`
              : "[Hook: No session ID]",
          },
        ],
      };
      return {
        response: "continue",
        body: modifiedResponse,
      };
    }
    return {
      response: "continue",
      body: response,
    };
  }
}
