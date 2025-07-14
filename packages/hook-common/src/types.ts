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

// Re-export MCP types for convenience
export type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  InitializeRequest,
  InitializeResult,
};

// Generic error type for transport errors
export const TransportErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
  responseType: z.enum(["http", "jsonrpc"]).optional(), // Track original response type
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
 */
export type GenericTransportErrorHookResult =
  | { resultType: "abort"; reason: string }
  | { resultType: "continue"; error: TransportError };

/**
 * Extract all method names from Hook interface that start with "process"
 */
export type HookProcessMethodName = Exclude<
  {
    [K in keyof Hook]: K extends `process${string}` ? K : never;
  }[keyof Hook],
  undefined
>;

export type HookProcessRequestMethodName = Exclude<
  {
    [K in HookProcessMethodName]: K extends `${string}Request` ? K : never;
  }[HookProcessMethodName],
  undefined
>;

export type HookProcessResponseMethodName = Exclude<
  {
    [K in HookProcessMethodName]: K extends `${string}Response` ? K : never;
  }[HookProcessMethodName],
  undefined
>;

export type HookProcessTransportErrorMethodName = Exclude<
  {
    [K in HookProcessMethodName]: K extends `${string}TransportError`
      ? K
      : never;
  }[HookProcessMethodName],
  undefined
>;

/**
 * Type helpers to find methods by parameter types
 */

// Find request method names that accept a specific request type
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

/**
 * Generic schema creators for hook results
 */

/**
 * Create a request hook result schema with proper types
 */
export const createRequestHookResultSchema = <
  TRequest extends z.ZodType,
  TResponse extends z.ZodType,
>(
  requestSchema: TRequest,
  responseSchema: TResponse,
) =>
  z.discriminatedUnion("resultType", [
    HookAbortSchema,
    z.object({
      resultType: z.literal("continue"),
      request: requestSchema,
    }),
    z.object({
      resultType: z.literal("respond"),
      response: responseSchema,
    }),
  ]);

/**
 * Create a response hook result schema with proper types
 */
export const createResponseHookResultSchema = <TResponse extends z.ZodType>(
  responseSchema: TResponse,
) =>
  z.discriminatedUnion("resultType", [
    HookAbortSchema,
    z.object({
      resultType: z.literal("continue"),
      response: responseSchema,
    }),
  ]);

/**
 * Create a transport error hook result schema
 */
export const createTransportErrorHookResultSchema = () =>
  z.discriminatedUnion("resultType", [
    HookAbortSchema,
    z.object({
      resultType: z.literal("continue"),
      error: TransportErrorSchema,
    }),
  ]);
