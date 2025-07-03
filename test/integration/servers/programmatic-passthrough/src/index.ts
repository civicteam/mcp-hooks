#!/usr/bin/env tsx
/**
 * Test passthrough server with programmatic hooks
 *
 * This server demonstrates using programmatic hooks (Hook instances)
 * instead of remote HTTP hooks.
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
  createPassthroughProxy,
} from "@civic/passthrough-mcp-server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type ToolCallWithHookData = {
  _hookData: { sessionCount: number };
};

/**
 * Simple call counter hook that tracks request count per session
 */
class CallCounterHook extends AbstractHook {
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

async function main() {
  const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 34101;
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33100"; // Echo server

  console.log(`Starting programmatic passthrough server on port ${port}`);
  console.log(`Connecting to target: ${targetUrl}`);

  // Create the counter hook instance
  const counterHook = new CallCounterHook();

  // Create passthrough proxy with programmatic hook
  const proxy = await createPassthroughProxy({
    transportType: "httpStream",
    port,
    target: {
      url: targetUrl,
      transportType: "httpStream",
    },
    hooks: [counterHook],
    serverInfo: {
      name: "programmatic-passthrough-test",
      version: "1.0.0",
    },
  });

  console.log(`Programmatic passthrough server is running on port ${port}`);
  console.log("Hook configured: CallCounterHook - Counts tool call requests");

  // Keep the process running
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await proxy.stop();
    process.exit(0);
  });
}

main().catch(console.error);
