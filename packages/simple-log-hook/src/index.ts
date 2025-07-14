/**
 * Simple Log Hook - Minimal logging hook implementation
 *
 * Demonstrates the simplest possible hook implementation
 * that just logs tool calls to console.
 */

import * as process from "node:process";
import {
  AbstractHook,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
  startHookServer,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Minimal hook implementation that logs to console
 */
class SimpleLogHook extends AbstractHook {
  /**
   * The name of this hook
   */
  get name(): string {
    return "SimpleLogHook";
  }

  async processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult> {
    console.log(`[REQUEST] ${toolCall.params.name}`, toolCall.params.arguments);

    // Call parent implementation to continue with unmodified tool call
    return super.processToolCallRequest(toolCall);
  }

  async processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult> {
    console.log(`[RESPONSE] ${originalToolCall.params.name}`, response);

    // Call parent implementation to continue with unmodified response
    return super.processToolCallResponse(response, originalToolCall);
  }
}

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33006;

// Create and start the server
const hook = new SimpleLogHook();
startHookServer(hook, PORT);
