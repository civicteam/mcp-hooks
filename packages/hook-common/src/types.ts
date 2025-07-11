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

// Generic error type for transport errors
export const TransportErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

export type TransportError = z.infer<typeof TransportErrorSchema>;

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

export const ToolCallTransportErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
      error: TransportErrorSchema,
    }),
  ],
);

export const ListToolsTransportErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
      error: TransportErrorSchema,
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
export type ToolCallTransportErrorHookResult = z.infer<
  typeof ToolCallTransportErrorHookResultSchema
>;
export type ListToolsTransportErrorHookResult = z.infer<
  typeof ListToolsTransportErrorHookResultSchema
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
  processToolCallRequest(
    toolCall: CallToolRequest,
  ): Promise<ToolCallRequestHookResult>;

  /**
   * Process a tool call response
   */
  processToolCallResponse(
    response: CallToolResult,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallResponseHookResult>;

  /**
   * Process a tools/list request (optional)
   */
  processToolsListRequest?(
    request: ListToolsRequest,
  ): Promise<ListToolsRequestHookResult>;

  /**
   * Process a tools/list response (optional)
   */
  processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult>;

  /**
   * Process transport errors for tool calls (optional)
   */
  processToolCallTransportError?(
    error: TransportError,
    originalToolCall: CallToolRequest,
  ): Promise<ToolCallTransportErrorHookResult>;

  /**
   * Process transport errors for tools/list requests (optional)
   */
  processToolsListTransportError?(
    error: TransportError,
    originalRequest: ListToolsRequest,
  ): Promise<ListToolsTransportErrorHookResult>;
}
