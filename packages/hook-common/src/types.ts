import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type InitializeResult,
  InitializeResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
  type Notification,
  NotificationSchema,
  type Request,
  RequestSchema,
  type Result,
  ResultSchema,
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
  InitializeRequest,
  InitializeResult,
  ListToolsRequest,
  ListToolsResult,
  Notification,
  Request,
  Result,
};

/**
 * Request context for hooks to inspect and modify HTTP request details
 *
 * Why: Hooks need to manipulate request metadata beyond just the message body.
 * This context provides access to:
 * 1. Headers - for authentication, custom headers, or header filtering
 * 2. Host - for conditional routing to different servers
 * 3. Path - for endpoint rewriting or versioning
 *
 * All fields are optional to maintain backward compatibility and allow
 * gradual adoption. Future fields might include cookies, query params, etc.
 */
export const RequestContextSchemaRaw = {
  headers: z.record(z.string()).optional(),
  host: z.string().optional(),
  path: z.string().optional(),
};

export const RequestContextSchema = z.object(RequestContextSchemaRaw);

export type RequestContext = z.infer<typeof RequestContextSchema>;

export const CallToolRequestSchemaWithContext = CallToolRequestSchema.extend({
  requestContext: RequestContextSchema.optional(),
});
export const ListToolsRequestSchemaWithContext = ListToolsRequestSchema.extend({
  requestContext: RequestContextSchema.optional(),
});
export const InitializeRequestSchemaWithContext =
  InitializeRequestSchema.extend({
    requestContext: RequestContextSchema.optional(),
  });

/**
 * Extended request types that include request context for hooks
 *
 * Why: Hooks need access to request metadata (headers, host, path) to make
 * routing decisions, add authentication, or modify the request destination.
 * These extended types maintain the original request structure while adding
 * the optional requestContext field for cleaner separation of concerns.
 */
export type CallToolRequestWithContext = CallToolRequest & {
  requestContext?: RequestContext;
};
export type ListToolsRequestWithContext = ListToolsRequest & {
  requestContext?: RequestContext;
};
export type InitializeRequestWithContext = InitializeRequest & {
  requestContext?: RequestContext;
};

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

export const CallToolRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: CallToolRequestSchemaWithContext,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: CallToolResultSchema,
    }),
  ],
);

export const CallToolResponseHookResultSchema = z.discriminatedUnion(
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
      request: ListToolsRequestSchemaWithContext,
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

export const InitializeRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    HookAbortSchema,
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: InitializeRequestSchemaWithContext,
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

export const RequestHookResultSchema = z.discriminatedUnion("resultType", [
  HookAbortSchema,
  // continue the hook chain, passing this (potentially updated) request
  z.object({
    resultType: z.literal("continue"),
    request: RequestSchema,
  }),
  // stop the request and return to the caller with this response
  z.object({
    resultType: z.literal("respond"),
    response: ResultSchema,
  }),
]);

export const ResponseHookResultSchema = z.discriminatedUnion("resultType", [
  HookAbortSchema,
  // continue the hook chain, passing this (potentially updated) response
  z.object({
    resultType: z.literal("continue"),
    response: ResultSchema,
  }),
]);

export const NotificationHookResultSchema = z.discriminatedUnion("resultType", [
  HookAbortSchema,
  // continue the hook chain, passing this (potentially updated) notification
  z.object({
    resultType: z.literal("continue"),
    notification: NotificationSchema,
  }),
]);

export type CallToolRequestHookResult = z.infer<
  typeof CallToolRequestHookResultSchema
>;
export type CallToolResponseHookResult = z.infer<
  typeof CallToolResponseHookResultSchema
>;
export type ListToolsRequestHookResult = z.infer<
  typeof ListToolsRequestHookResultSchema
>;
export type ListToolsResponseHookResult = z.infer<
  typeof ListToolsResponseHookResultSchema
>;
export type InitializeRequestHookResult = z.infer<
  typeof InitializeRequestHookResultSchema
>;
export type InitializeResponseHookResult = z.infer<
  typeof InitializeResponseHookResultSchema
>;
export type RequestHookResult = z.infer<typeof RequestHookResultSchema>;
export type ResponseHookResult = z.infer<typeof ResponseHookResultSchema>;
export type NotificationHookResult = z.infer<
  typeof NotificationHookResultSchema
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
  processCallToolRequest?(
    request: CallToolRequestWithContext,
  ): Promise<CallToolRequestHookResult>;

  /**
   * Process a tool call response
   */
  processCallToolResult?(
    result: CallToolResult,
    originalCallToolRequest: CallToolRequestWithContext,
  ): Promise<CallToolResponseHookResult>;

  /**
   * Process a tools/list request (optional)
   */
  processListToolsRequest?(
    request: ListToolsRequestWithContext,
  ): Promise<ListToolsRequestHookResult>;

  /**
   * Process a tools/list response (optional)
   */
  processListToolsResult?(
    result: ListToolsResult,
    originalListToolsRequest: ListToolsRequestWithContext,
  ): Promise<ListToolsResponseHookResult>;

  /**
   * Process an initialize request (optional)
   */
  processInitializeRequest?(
    request: InitializeRequestWithContext,
  ): Promise<InitializeRequestHookResult>;

  /**
   * Process an initialize response (optional)
   */
  processInitializeResult?(
    result: InitializeResult,
    originalInitializeRequest: InitializeRequestWithContext,
  ): Promise<InitializeResponseHookResult>;

  /**
   * Process a request from the client NOT covered by a dedicated handler (optional)
   */
  processOtherRequest?(request: Request): Promise<RequestHookResult>;

  /**
   * Process a reponse from the client NOT covered by a dedicated handler (optional)
   */
  processOtherResult?(
    result: Result,
    originalRequest: Request,
  ): Promise<ResponseHookResult>;

  /**
   * Process a target request (request coming from the target server back to the client) (optional)
   */
  processTargetRequest?(request: Request): Promise<RequestHookResult>;

  /**
   * Process a target response (response going back to the target server) (optional)
   */
  processTargetResult?(
    result: Result,
    originalRequest: Request,
  ): Promise<ResponseHookResult>;

  /**
   * Process a notification (notification from client to target server) (optional)
   */
  processNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult>;

  /**
   * Process a target notification (notification from target server to client) (optional)
   */
  processTargetNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult>;
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
 * Type helpers to find methods by parameter types
 *
 * These types solve a specific problem: We have a request object (like CallToolRequest)
 * and we need to find which Hook methods can process it. Instead of hardcoding
 * "processCallToolRequest", we use TypeScript to figure it out automatically.
 *
 * This ensures that if someone passes a CallToolRequest, they can only specify
 * method names that actually accept CallToolRequest as a parameter.
 */

/**
 * Find all Hook method names that accept a specific request type
 *
 * Example: MethodsWithRequestType<CallToolRequest> will return "processCallToolRequest"
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
