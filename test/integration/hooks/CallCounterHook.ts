import {
  AbstractHook,
  type CallToolRequest,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
  type CallToolResult,
} from "@civic/passthrough-mcp-server";

type CallToolRequestWithHookData = CallToolRequest & {
  params: CallToolRequest["params"] & {
    _meta?: CallToolRequest["params"]["_meta"] & {
      _hookData?: { sessionCount: number };
    };
  };
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
  ): Promise<CallToolRequestHookResult> {
    // Get session ID from _meta
    const sessionId = toolCall.params._meta?.sessionId || "default";

    console.log(
      `[CallCounterHook] Session ${sessionId}: ${toolCall.params.name}`,
    );

    // Increment count for this session
    const currentCount = (this.sessionCounts.get(sessionId) || 0) + 1;
    this.sessionCounts.set(sessionId, currentCount);

    console.log(
      `[CallCounterHook] Session ${sessionId} - Request #${currentCount}: ${toolCall.params.name}`,
    );

    // Store the count in the tool call for use in processResponse
    toolCall.params._meta = {
      ...toolCall.params._meta,
      _hookData: { sessionCount: currentCount },
    };

    return {
      resultType: "continue",
      request: toolCall,
    };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    // Get the session count from the modified tool call
    const sessionCount: number =
      (originalToolCall as CallToolRequestWithHookData).params._meta?._hookData
        .sessionCount || 0;

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
