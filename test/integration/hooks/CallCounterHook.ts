import {
  AbstractHook,
  type CallToolRequest,
  type CallToolResult,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
} from "@civic/passthrough-mcp-server";

type CallToolRequestWithHookData = CallToolRequest & {
  _hookData?: { sessionCount: number };
};

/**
 * Simple call counter hook that tracks request count per session
 */
export class CallCounterHook extends AbstractHook {
  private sessionCounts = new Map<string, number>();

  get name(): string {
    return "CallCounterHook";
  }

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    // Get session ID from _meta
    const sessionId = toolCall.params._meta?.sessionId || "default";

    // Increment count for this session
    const currentCount = (this.sessionCounts.get(sessionId) || 0) + 1;
    this.sessionCounts.set(sessionId, currentCount);

    console.log(
      `[CallCounterHook] Session ${sessionId} - Request #${currentCount}: ${toolCall.params.name}`,
    );

    // Store the count in the tool call for use in processResponse
    const modifiedToolCall: CallToolRequestWithHookData = {
      ...toolCall,
      _hookData: { sessionCount: currentCount },
    };

    return {
      resultType: "continue",
      request: modifiedToolCall as CallToolRequest,
    };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    // Get the session count from the modified tool call
    const sessionCount =
      (originalToolCall as CallToolRequestWithHookData)._hookData
        ?.sessionCount || 0;

    // Add request count to the response
    const modifiedResponse: CallToolResult = {
      ...response,
      content: [
        ...response.content,
        {
          type: "text" as const,
          text: `[Hook: Request count is ${sessionCount}]`,
        },
      ],
    };
    return {
      resultType: "continue",
      response: modifiedResponse,
    };
  }
}
