import type { CallToolRequest } from "@modelcontextprotocol/sdk/types";
import {
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Re-export MCP types for convenience
export type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
};

// Abort the request or response, and return to the caller with the abort reason
const HookAbortSchema = z.object({
  resultType: z.literal("abort"),
  reason: z.string(),
});

export const ToolCallRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: CallToolRequestSchema,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: CallToolResultSchema,
    }),
  ],
);

export const ToolCallResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: CallToolResultSchema,
    }),
  ],
);

export const ListToolsRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: ListToolsRequestSchema,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListToolsResultSchema,
    }),
  ],
);

export const ListToolsResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: ListToolsResultSchema,
    }),
  ],
);

export type ToolCallRequestHookResult = z.infer<
  typeof ToolCallRequestHookResultSchema
>;
export type ToolCallResponseHookResult = z.infer<
  typeof ToolCallResponseHookResultSchema
>;
export type ListToolsRequestHookResult = z.infer<
  typeof ListToolsRequestHookResultSchema
>;
export type ListToolsResponseHookResult = z.infer<
  typeof ListToolsResponseHookResultSchema
>;
/**
 * Hook interface that all hooks must implement
 */
export interface Hook {
  /**
   * The name of this hook
   */
  get name(): string;

  /**
   * Process an incoming tool call request
   */
  processRequest(toolCall: CallToolRequest): Promise<ToolCallRequestHookResult>;

  /**
   * Process a tool call response
   */
  processResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult>;

  /**
   * Process a tools/list request (optional)
   */
  processToolsList?(
    request: ListToolsRequest,
  ): Promise<ListToolsRequestHookResult>;

  /**
   * Process a tools/list response (optional)
   */
  processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult>;
}
