import {
  AbstractHook,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
  type ListToolsResponseHookResult,
} from "@civic/hook-common";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  ServerNotification,
  ServerRequest,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { type ZodRawShape, z } from "zod";
import {
  type JsonSchema7ObjectType,
  zodToJsonSchema,
} from "zod-to-json-schema";
import type { ToolDefinition } from "./types.js";

const toolDefinitionToTool = <Args extends ZodRawShape>(
  tool: ToolDefinition<Args>,
): Tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(
    z.object(tool.paramsSchema),
  ) as JsonSchema7ObjectType,
});

export class LocalToolsHook extends AbstractHook {
  constructor(
    private tools: ToolDefinition<ZodRawShape>[],
    private timeoutMs = 5000,
  ) {
    super();
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "LocalToolsHook";
  }

  /**
   * Process an incoming tool call request
   * If the tool is a local tool, execute it and return a "respond" response
   * Otherwise, return "continue" to pass through to the remote server
   */
  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    // Check if this tool call is for one of our local tools
    const localTool = this.tools.find(
      (tool) => tool.name === request.params.name,
    );

    if (!localTool) {
      // Not a local tool, continue to remote server
      return {
        resultType: "continue",
        request,
      };
    }
    // execute the local tool
    const result = await localTool.cb(request.params.arguments as ZodRawShape, {
      signal: AbortSignal.timeout(this.timeoutMs),
      requestId: "",
      sendNotification: (notification: ServerNotification): Promise<void> => {
        throw new Error("Function not implemented.");
      },
      sendRequest: <U extends z.ZodType<object>>(
        request: ServerRequest,
        resultSchema: U,
        options?: RequestOptions,
      ): Promise<z.TypeOf<U>> => {
        throw new Error("Function not implemented.");
      },
    });

    // Return a "respond" response with the tool result
    return {
      resultType: "respond",
      response: result,
    };
  }

  /**
   * Process a tools/list response to add local tools to the list
   */
  async processCallToolResult(
    response: CallToolResult,
    originalRequest: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    // Local tools are handled in processCallToolRequest,
    // so we always continue with the response as-is
    return {
      resultType: "continue",
      response,
    };
  }

  async processListToolsResult(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult> {
    // Convert local tool definitions to MCP Tool format
    const localToolDescriptions: Tool[] = this.tools.map(toolDefinitionToTool);

    // Merge local tools with remote tools
    const mergedResponse: ListToolsResult = {
      ...response,
      tools: [...(response.tools || []), ...localToolDescriptions],
    };

    return {
      resultType: "continue",
      response: mergedResponse,
    };
  }
}
