import type {
  CallToolRequest,
  InitializeRequest,
  InitializeResult,
} from "@modelcontextprotocol/sdk/types";
import {
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Re-export MCP types for convenience
 *
 * Why: These are the core MCP protocol types that hooks need to work with.
 * By re-exporting them from our package, we:
 * 1. Provide a single import point for consumers
 * 2. Shield our API from potential breaking changes in the MCP SDK
 * 3. Could add our own extensions/wrappers in the future without breaking consumers
 */
export type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  InitializeRequest,
  InitializeResult,
};

/**
 * Generic error type for transport errors
 *
 * Why: MCP servers communicate over different transports (HTTP, stdio, etc).
 * When errors occur at the transport layer (e.g., network failures, 5xx errors),
 * we need a common format to represent them so hooks can:
 * 1. Inspect error codes to make decisions (e.g., retry on 503, alert on 500)
 * 2. Transform error messages before they reach the client
 * 3. Track which transport type caused the error for debugging
 */
export const TransportErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
  responseType: z.enum(["http", "jsonrpc"]).optional(), // Track original response type
});

export type TransportError = z.infer<typeof TransportErrorSchema>;

/**
 * Base schema for aborting hook processing
 *
 * Why: Hooks need a way to stop the request/response pipeline entirely.
 * This is critical for security hooks that need to block dangerous operations,
 * or validation hooks that detect invalid requests. The abort pattern ensures
 * no further processing occurs and provides a clear reason to the caller.
 */
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
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: CallToolResultSchema,
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
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListToolsResultSchema,
    }),
  ],
);

export const InitializeRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: InitializeRequestSchema,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: InitializeResultSchema,
    }),
  ],
);

export const InitializeResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: InitializeResultSchema,
    }),
  ],
);

export const InitializeTransportErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
      error: TransportErrorSchema,
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: InitializeResultSchema,
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
export type InitializeRequestHookResult = z.infer<
  typeof InitializeRequestHookResultSchema
>;
export type InitializeResponseHookResult = z.infer<
  typeof InitializeResponseHookResultSchema
>;
export type InitializeTransportErrorHookResult = z.infer<
  typeof InitializeTransportErrorHookResultSchema
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
  processToolCallRequest?(
    request: CallToolRequest,
  ): Promise<ToolCallRequestHookResult>;

  /**
   * Process a tool call response
   */
  processToolCallResponse?(
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

  /**
   * Process an initialize request (optional)
   */
  processInitializeRequest?(
    request: InitializeRequest,
  ): Promise<InitializeRequestHookResult>;

  /**
   * Process an initialize response (optional)
   */
  processInitializeResponse?(
    response: InitializeResult,
    originalRequest: InitializeRequest,
  ): Promise<InitializeResponseHookResult>;

  /**
   * Process transport errors for initialize requests (optional)
   */
  processInitializeTransportError?(
    error: TransportError,
    originalRequest: InitializeRequest,
  ): Promise<InitializeTransportErrorHookResult>;
}

/**
 * Generic TypeScript types for hook results
 */

/**
 * Generic type for request hook results
 * - abort: Stop processing with a reason
 * - continue: Continue with potentially modified request
 * - respond: Return response directly without forwarding
 */
export type GenericRequestHookResult<TRequest, TResponse> =
  | { resultType: "abort"; reason: string }
  | { resultType: "continue"; request: TRequest }
  | { resultType: "respond"; response: TResponse };

/**
 * Generic type for response hook results
 * - abort: Stop processing with a reason
 * - continue: Continue with potentially modified response
 */
export type GenericResponseHookResult<TResponse> =
  | { resultType: "abort"; reason: string }
  | { resultType: "continue"; response: TResponse };

/**
 * Generic type for transport error hook results
 * - abort: Stop processing with a reason
 * - continue: Continue with potentially modified error
 * - respond: Stop processing and return a successful response
 */
export type GenericTransportErrorHookResult<TResponse> =
  | { resultType: "abort"; reason: string }
  | { resultType: "continue"; error: TransportError }
  | { resultType: "respond"; response: TResponse };

/**
 * Type helpers to find methods by parameter types
 *
 * These types solve a specific problem: We have a request object (like CallToolRequest)
 * and we need to find which Hook methods can process it. Instead of hardcoding
 * "processToolCallRequest", we use TypeScript to figure it out automatically.
 *
 * This ensures that if someone passes a CallToolRequest, they can only specify
 * method names that actually accept CallToolRequest as a parameter.
 */

/**
 * Find all Hook method names that accept a specific request type
 *
 * Example: MethodsWithRequestType<CallToolRequest> will return "processToolCallRequest"
 * because that's the only method that accepts CallToolRequest as its first parameter.
 *
 * How it works:
 * 1. [K in keyof Hook]: Loop through all properties of Hook interface
 * 2. Hook[K] extends ((request: infer R) => unknown) | undefined:
 *    - Check if the property is a function that takes a request parameter
 *    - "infer R" captures the actual type of that parameter
 *    - The "| undefined" handles optional methods
 * 3. R extends TRequest ? K : never:
 *    - If the parameter type matches our TRequest, include this method name (K)
 *    - Otherwise, exclude it (never)
 * 4. [keyof Hook] at the end: Collect all the method names that passed the test
 * 5. Exclude<..., undefined>: Remove undefined from the final union type
 *
 * This creates compile-time safety: you literally cannot pass an invalid method name.
 */
export type MethodsWithRequestType<TRequest> = Exclude<
  {
    [K in keyof Hook]: Hook[K] extends
      | ((request: infer R) => unknown)
      | undefined
      ? R extends TRequest
        ? K
        : never
      : never;
  }[keyof Hook],
  undefined
>;

// Find response method names that accept specific response and request types
export type MethodsWithResponseType<TResponse, TRequest> = Exclude<
  {
    [K in keyof Hook]: Hook[K] extends
      | ((
          response: infer R,
          originalRequest: infer O,
          ...args: unknown[]
        ) => unknown)
      | undefined
      ? R extends TResponse
        ? O extends TRequest
          ? K
          : never
        : never
      : never;
  }[keyof Hook],
  undefined
>;

// Find transport error method names that accept a specific request type
export type MethodsWithTransportErrorType<TRequest> = Exclude<
  {
    [K in keyof Hook]: Hook[K] extends
      | ((
          error: TransportError,
          originalRequest: infer R,
          ...args: unknown[]
        ) => unknown)
      | undefined
      ? R extends TRequest
        ? K
        : never
      : never;
  }[keyof Hook],
  undefined
>;
