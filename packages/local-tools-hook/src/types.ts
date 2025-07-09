import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

export type ToolDefinition<Args extends ZodRawShape> = {
  name: string;
  description: string;
  paramsSchemaOrAnnotations: Args;
  cb: ToolCallback<Args>;
};
