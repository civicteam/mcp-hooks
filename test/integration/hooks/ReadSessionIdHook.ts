import {
  AbstractHook,
  type CallToolRequest,
  type CallToolResult,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
} from "@civic/passthrough-sdk";

/**
 * Hook that reads the session ID from metadata and adds it to the response
 */
export class ReadSessionIdHook extends AbstractHook {
  get name(): string {
    return "ReadSessionIdHook";
  }

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    return {
      resultType: "continue",
      request: toolCall,
    };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    // Get session ID from _meta
    const sessionId = originalToolCall.params._meta?.sessionId;

    // Add session ID to the response
    const modifiedResponse: CallToolResult = {
      ...response,
      content: [
        ...response.content,
        {
          type: "text" as const,
          text: sessionId
            ? `[Hook: Session ID is ${sessionId}]`
            : "[Hook: No session ID]",
        },
      ],
    };
    return {
      resultType: "continue",
      response: modifiedResponse,
    };
  }
}
