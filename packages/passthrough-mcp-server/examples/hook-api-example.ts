/**
 * Example: Using the Hook API
 *
 * This example demonstrates how to use the hook API
 * for integrating hooks into your services.
 */

import {
  AbstractHook,
  type CallToolRequest,
  type CallToolResult,
  type Hook,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
  createHookClient,
  createHookClients,
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "@civic/passthrough-mcp-server";

/**
 * Example: Create a validation hook using AbstractHook
 */
class ValidationHook extends AbstractHook {
  get name() {
    return "validation-hook";
  }

  private allowedTools = ["search", "calculate", "format"];

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    // Check if tool is allowed
    if (!this.allowedTools.includes(toolCall.params.name)) {
      return {
        resultType: "abort",
        reason: `Tool '${toolCall.params.name}' is not allowed`,
      };
    }

    // All validations passed
    return { resultType: "continue", request: toolCall };
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    return { resultType: "continue", response };
  }
}

/**
 * Example integration showing how to use the hook API
 */
async function processToolCallWithHooks(
  toolCall: CallToolRequest,
): Promise<unknown> {
  // Create hook clients from definitions
  const hooks: Hook[] = createHookClients([
    new ValidationHook(), // Local hook instance
    { url: "http://audit-service.example.com/hook" }, // Remote hook URL
  ]);

  // Apply request hooks
  const requestResult = await processRequestThroughHooks<
    CallToolRequest,
    CallToolResult,
    "processToolCallRequest"
  >(toolCall, hooks, "processToolCallRequest");

  if (requestResult.resultType === "abort") {
    console.error("Request rejected:", requestResult.reason);
    return {
      error: requestResult.reason,
      status: "rejected",
    };
  }

  if (requestResult.resultType === "respond") {
    // Hook provided a direct response
    return requestResult.response;
  }

  // Process the tool call (this would be your actual tool execution)
  const response = await executeToolCall(requestResult.request);

  // Apply response hooks
  const responseResult = await processResponseThroughHooks<
    CallToolRequest,
    CallToolResult,
    "processToolCallResponse"
  >(
    response as CallToolResult,
    requestResult.request,
    hooks,
    requestResult.lastProcessedIndex,
    "processToolCallResponse",
  );

  if (responseResult.resultType === "abort") {
    console.error("Response rejected:", responseResult.reason);
    return {
      error: responseResult.reason,
      status: "rejected",
    };
  }

  return responseResult.response;
}

/**
 * Integration pattern for service classes
 */
class ToolService {
  private hooks: Hook[];

  constructor(
    hookDefinitions: Array<AbstractHook | { url: string; name?: string }>,
  ) {
    this.hooks = createHookClients(hookDefinitions);
  }

  async execute(toolCall: CallToolRequest): Promise<unknown> {
    // Apply request hooks
    const requestResult = await processRequestThroughHooks<
      CallToolRequest,
      CallToolResult,
      "processToolCallRequest"
    >(toolCall, this.hooks, "processToolCallRequest");

    if (requestResult.resultType === "abort") {
      throw new Error(`Request rejected: ${requestResult.reason}`);
    }

    if (requestResult.resultType === "respond") {
      return requestResult.response;
    }

    // Execute the tool
    const response = await this.executeInternal(requestResult.request);

    // Apply response hooks
    const responseResult = await processResponseThroughHooks<
      CallToolRequest,
      CallToolResult,
      "processToolCallResponse"
    >(
      response as CallToolResult,
      requestResult.request,
      this.hooks,
      requestResult.lastProcessedIndex,
      "processToolCallResponse",
    );

    if (responseResult.resultType === "abort") {
      throw new Error(`Response rejected: ${responseResult.reason}`);
    }

    return responseResult.response;
  }

  private async executeInternal(toolCall: CallToolRequest): Promise<unknown> {
    // Your actual tool execution logic here
    console.log(`Executing tool: ${toolCall.params.name}`);
    return {
      content: [
        {
          type: "text",
          text: `Executed ${toolCall.params.name}`,
        },
      ],
    };
  }
}

// Helper function to simulate tool execution
async function executeToolCall(toolCall: CallToolRequest): Promise<unknown> {
  console.log(`Executing tool: ${toolCall.params.name}`);

  // Simulate different tool responses
  switch (toolCall.params.name) {
    case "search":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                { title: "Result 1", url: "https://example.com/1" },
                { title: "Result 2", url: "https://example.com/2" },
              ],
              query: (toolCall.params.arguments as { query: string }).query,
            }),
          },
        ],
      };

    case "calculate":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              result: 42,
              expression: (toolCall.params.arguments as { expression: string })
                .expression,
            }),
          },
        ],
      };

    default:
      return {
        content: [
          {
            type: "text",
            text: `Executed ${toolCall.params.name}`,
          },
        ],
      };
  }
}

// Example usage
async function main() {
  // Example 1: Direct usage
  console.log("=== Example 1: Direct Usage ===");
  const searchCall: CallToolRequest = {
    method: "tools/call",
    params: {
      name: "search",
      arguments: { query: "MCP hooks" },
    },
  };

  const result1 = await processToolCallWithHooks(searchCall);
  console.log("Search result:", result1);

  // Example 2: Forbidden tool
  console.log("\n=== Example 2: Forbidden Tool ===");
  const forbiddenCall: CallToolRequest = {
    method: "tools/call",
    params: {
      name: "delete",
      arguments: { id: "123" },
    },
  };

  const result2 = await processToolCallWithHooks(forbiddenCall);
  console.log("Forbidden result:", result2);

  // Example 3: Using the service class
  console.log("\n=== Example 3: Service Class Usage ===");
  const service = new ToolService([
    new ValidationHook(),
    // Add more hooks as needed
  ]);

  try {
    const result3 = await service.execute({
      method: "tools/call",
      params: {
        name: "calculate",
        arguments: { expression: "2 + 2" },
      },
    });
    console.log("Calculation result:", result3);
  } catch (error) {
    console.error("Service error:", error);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
