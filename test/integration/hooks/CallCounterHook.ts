import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/passthrough-mcp-server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type ToolCallWithHookData = {
  _hookData: { sessionCount: number };
};

/**
 * Simple call counter hook that tracks request count per session
 */
export class CallCounterHook extends AbstractHook {
  private sessionCounts = new Map<string, number>();

  get name(): string {
    return "CallCounterHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    // Get session ID from metadata
    const sessionId = toolCall.metadata?.sessionId || "default";

    // Increment count for this session
    const currentCount = (this.sessionCounts.get(sessionId) || 0) + 1;
    this.sessionCounts.set(sessionId, currentCount);

    console.log(
      `[CallCounterHook] Session ${sessionId} - Request #${currentCount}: ${toolCall.name}`,
    );

    // Store the count in the tool call for use in processResponse
    const modifiedToolCall = {
      ...toolCall,
      _hookData: { sessionCount: currentCount },
    };

    return {
      response: "continue",
      body: modifiedToolCall,
    };
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall & ToolCallWithHookData,
  ): Promise<HookResponse> {
    const callToolResult = response as CallToolResult;
    // Get the session count from the modified tool call
    const sessionCount = originalToolCall._hookData?.sessionCount || 0;

    // Add request count to the response
    if (response && typeof response === "object" && "content" in response) {
      const modifiedResponse = {
        ...callToolResult,
        content: [
          ...callToolResult.content,
          {
            type: "text",
            text: `[Hook: Request count is ${sessionCount}]`,
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
