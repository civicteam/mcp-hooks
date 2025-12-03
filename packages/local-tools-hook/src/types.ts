import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";

export type ToolDefinition<Args extends ZodRawShape> = {
  name: string;
  description: string;
  paramsSchema: Args;
  cb: ToolCallback<Args>;
};
