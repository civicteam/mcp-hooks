/**
 * Simple Log Hook - Minimal logging hook implementation
 *
 * Demonstrates the simplest possible hook implementation
 * that just logs tool calls to console.
 */

import * as process from "node:process";
import {
  AbstractHook,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
  type RequestExtra,
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

  async processCallToolRequest(
    request: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult> {
    console.log(
      `[REQUEST ${requestExtra.requestId}] ${request.params.name}`,
      request.params.arguments,
    );

    // Call parent implementation to continue with unmodified tool call
    return super.processCallToolRequest(request, requestExtra);
  }

  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
    requestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult> {
    console.log(
      `[RESPONSE ${requestExtra.requestId}] ${originalCallToolRequest.params.name}`,
      response,
    );

    // Call parent implementation to continue with unmodified response
    return super.processCallToolResult(
      response,
      originalCallToolRequest,
      requestExtra,
    );
  }
}

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33006;

// Create and start the server
const hook = new SimpleLogHook();
startHookServer(hook, PORT);
