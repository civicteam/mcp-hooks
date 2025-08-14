/**
 * Explain Hook Implementation
 *
 * Adds a "reason" parameter to all tools to encourage thoughtful tool usage
 */

import {
  AbstractHook,
  type CallToolRequestHookResult,
  type ListToolsResponseHookResult,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

export class ExplainHook extends AbstractHook {
  /**
   * The name of this hook
   */
  get name(): string {
    return "ExplainHook";
  }

  /**
   * Process an incoming tool call request to validate and strip the reason parameter
   */
  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    // Clone the tool call to avoid modifying the original
    const modifiedToolCall = { ...request };

    // Check if arguments exist and are an object
    if (
      typeof modifiedToolCall.params.arguments !== "object" ||
      modifiedToolCall.params.arguments === null
    ) {
      return {
        resultType: "abort",
        reason: "Tool call must include arguments with a 'reason' parameter",
      };
    }

    const args = modifiedToolCall.params.arguments as Record<string, unknown>;

    // Check if reason exists and is not empty
    if (
      !("reason" in args) ||
      !args.reason ||
      (typeof args.reason === "string" && args.reason.trim() === "")
    ) {
      return {
        resultType: "abort",
        reason:
          "Missing or empty 'reason' parameter. Please provide a justification for using this tool.",
      };
    }

    // Log the reason before removing it
    console.log(`[${request.params.name}] Reason: ${args.reason}`);

    // Clone arguments and remove the reason
    const { reason: _, ...strippedArguments } = args;
    modifiedToolCall.params.arguments = strippedArguments;

    return {
      resultType: "continue",
      request: modifiedToolCall,
    };
  }
  /**
   * Process a tools/list response to add the reason parameter to all tools
   */
  async processListToolsResult(
    response: ListToolsResult,
    _originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult> {
    // Clone the response to avoid modifying the original
    const modifiedResponse: ListToolsResult = {
      ...response,
      tools: response.tools.map((tool) => {
        // Clone the tool to avoid modifying the original
        const modifiedTool = { ...tool };

        // Ensure inputSchema exists and is an object schema
        if (!modifiedTool.inputSchema) {
          modifiedTool.inputSchema = {
            type: "object",
            properties: {},
            required: [],
          };
        }

        // Type guard to ensure we're working with an object schema
        const schema = modifiedTool.inputSchema as {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        };

        // Ensure it's an object type
        if (schema.type !== "object") {
          console.warn(
            `Tool ${tool.name} has non-object schema type: ${schema.type}. Skipping reason parameter addition.`,
          );
          return modifiedTool;
        }

        // Ensure properties exist
        if (!schema.properties) {
          schema.properties = {};
        }

        // Add the reason parameter
        schema.properties.reason = {
          type: "string",
          description:
            "A justification for using this tool, explaining how it helps achieve your goal. Should contain the following: " +
            "GOAL: <Your current goal>, JUSTIFICATION: <how this tool helps achieve the goal>, CHOICE: <why you chose to use this tool over other available tools>.",
        };

        // Ensure required array exists and add reason to it
        if (!schema.required) {
          schema.required = [];
        }
        if (!schema.required.includes("reason")) {
          schema.required.push("reason");
        }

        return modifiedTool;
      }),
    };

    console.log(`Added 'reason' parameter to ${response.tools.length} tools`);

    return {
      resultType: "continue",
      response: modifiedResponse,
    };
  }
}
