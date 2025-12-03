import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type InitializeResult,
  InitializeResultSchema,
  type ListPromptsRequest,
  ListPromptsRequestSchema,
  type ListPromptsResult,
  ListPromptsResultSchema,
  type ListResourceTemplatesRequest,
  ListResourceTemplatesRequestSchema,
  type ListResourceTemplatesResult,
  ListResourceTemplatesResultSchema,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  ListResourcesResultSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
  type Notification,
  NotificationSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type ReadResourceResult,
  ReadResourceResultSchema,
  type Request,
  type RequestId,
  type RequestInfo,
  type RequestMeta,
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
  ListPromptsRequest,
  ListPromptsResult,
  ListResourcesRequest,
  ListResourcesResult,
  ListResourceTemplatesRequest,
  ListResourceTemplatesResult,
  ListToolsRequest,
  ListToolsResult,
  Notification,
  ReadResourceRequest,
  ReadResourceResult,
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
  headers: z.record(z.string(), z.string()).optional(),
  host: z.string().optional(),
  path: z.string().optional(),
};

export const RequestContextSchema = z.object(RequestContextSchemaRaw);

export type RequestContext = z.infer<typeof RequestContextSchema>;

export const CallToolRequestSchemaWithContext = CallToolRequestSchema.extend({
  requestContext: RequestContextSchema.optional(),
});
export const ListPromptsRequestSchemaWithContext =
  ListPromptsRequestSchema.extend({
    requestContext: RequestContextSchema.optional(),
  });
export const ListToolsRequestSchemaWithContext = ListToolsRequestSchema.extend({
  requestContext: RequestContextSchema.optional(),
});
export const InitializeRequestSchemaWithContext =
  InitializeRequestSchema.extend({
    requestContext: RequestContextSchema.optional(),
  });

export const ListResourcesRequestSchemaWithContext =
  ListResourcesRequestSchema.extend({
    requestContext: RequestContextSchema.optional(),
  });

export const ListResourceTemplatesRequestSchemaWithContext =
  ListResourceTemplatesRequestSchema.extend({
    requestContext: RequestContextSchema.optional(),
  });

export const ReadResourceRequestSchemaWithContext =
  ReadResourceRequestSchema.extend({
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
export type ListPromptsRequestWithContext = ListPromptsRequest & {
  requestContext?: RequestContext;
};
export type ListToolsRequestWithContext = ListToolsRequest & {
  requestContext?: RequestContext;
};
export type InitializeRequestWithContext = InitializeRequest & {
  requestContext?: RequestContext;
};
export type ListResourcesRequestWithContext = ListResourcesRequest & {
  requestContext?: RequestContext;
};
export type ListResourceTemplatesRequestWithContext =
  ListResourceTemplatesRequest & {
    requestContext?: RequestContext;
  };
export type ReadResourceRequestWithContext = ReadResourceRequest & {
  requestContext?: RequestContext;
};

/**
 * Generic error type for protocol-level errors
 *
 * This is basically an McpError
 */
export const HookChainErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

export type HookChainError = z.infer<typeof HookChainErrorSchema>;

/**
 * Base schema for aborting hook processing
 *
 * Why: Hooks need a way to stop the request/response pipeline entirely.
 * This is critical for security hooks that need to block dangerous operations,
 * or validation hooks that detect invalid requests. The abort pattern ensures
 * no further processing occurs and provides a clear reason to the caller.
 */
// @deprecated. This is fully replaced by throwing McpErrors from Hooks.
// const HookAbortSchema = z.object({
//   resultType: z.literal("abort"),
//   reason: z.string(),
// });

export const CallToolRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
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
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: CallToolResultSchema,
    }),
  ],
);

export const CallToolErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: CallToolResultSchema,
    }),
  ],
);

export const ListPromptsErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListPromptsResultSchema,
    }),
  ],
);

export const ListToolsErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListToolsResultSchema,
    }),
  ],
);

export const InitializeErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: InitializeResultSchema,
    }),
  ],
);

export const OtherErrorHookResultSchema = z.discriminatedUnion("resultType", [
  // continue the hook chain, passing this (potentially updated) error
  z.object({
    resultType: z.literal("continue"),
  }),
  // stop the error handling and replace the error with this response
  z.object({
    resultType: z.literal("respond"),
    response: ResultSchema,
  }),
]);

export const TargetErrorHookResultSchema = z.discriminatedUnion("resultType", [
  // continue the hook chain, passing this (potentially updated) error
  z.object({
    resultType: z.literal("continue"),
  }),
  // stop the error handling and replace the error with this response
  z.object({
    resultType: z.literal("respond"),
    response: ResultSchema,
  }),
]);

export const NotificationErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // notifications don't have responses, so we can only continue
  ],
);

export const TargetNotificationErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // notifications don't have responses, so we can only continue
  ],
);

export const ListResourcesRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: ListResourcesRequestSchemaWithContext,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListResourcesResultSchema,
    }),
  ],
);

export const ListResourcesResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: ListResourcesResultSchema,
    }),
  ],
);

export const ListResourcesErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListResourcesResultSchema,
    }),
  ],
);

export const ListResourceTemplatesRequestHookResultSchema =
  z.discriminatedUnion("resultType", [
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: ListResourceTemplatesRequestSchemaWithContext,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListResourceTemplatesResultSchema,
    }),
  ]);

export const ListResourceTemplatesResponseHookResultSchema =
  z.discriminatedUnion("resultType", [
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: ListResourceTemplatesResultSchema,
    }),
  ]);

export const ListResourceTemplatesErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListResourceTemplatesResultSchema,
    }),
  ],
);

export const ReadResourceRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: ReadResourceRequestSchemaWithContext,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: ReadResourceResultSchema,
    }),
  ],
);

export const ReadResourceResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: ReadResourceResultSchema,
    }),
  ],
);

export const ReadResourceErrorHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) error
    z.object({
      resultType: z.literal("continue"),
    }),
    // stop the error handling and replace the error with this response
    z.object({
      resultType: z.literal("respond"),
      response: ReadResourceResultSchema,
    }),
  ],
);

export const ListPromptsRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) request
    z.object({
      resultType: z.literal("continue"),
      request: ListPromptsRequestSchemaWithContext,
    }),
    // stop the request and return to the caller with this response
    z.object({
      resultType: z.literal("respond"),
      response: ListPromptsResultSchema,
    }),
  ],
);

export const ListToolsRequestHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
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

export const ListPromptsResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: ListPromptsResultSchema,
    }),
  ],
);

export const ListToolsResponseHookResultSchema = z.discriminatedUnion(
  "resultType",
  [
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
    // continue the hook chain, passing this (potentially updated) response
    z.object({
      resultType: z.literal("continue"),
      response: InitializeResultSchema,
    }),
  ],
);

export const RequestHookResultSchema = z.discriminatedUnion("resultType", [
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
  // continue the hook chain, passing this (potentially updated) response
  z.object({
    resultType: z.literal("continue"),
    response: ResultSchema,
  }),
]);

export const NotificationHookResultSchema = z.discriminatedUnion("resultType", [
  // continue the hook chain, passing this (potentially updated) notification
  z.object({
    resultType: z.literal("continue"),
    notification: NotificationSchema,
  }),
]);

export type CallToolRequestHookResult =
  | z.infer<typeof CallToolRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: CallToolRequestWithContext;
      response: CallToolResult;
      callback: (
        response: CallToolResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type CallToolResponseHookResult = z.infer<
  typeof CallToolResponseHookResultSchema
>;
export type CallToolErrorHookResult = z.infer<
  typeof CallToolErrorHookResultSchema
>;
export type ListPromptsErrorHookResult = z.infer<
  typeof ListPromptsErrorHookResultSchema
>;
export type ListToolsErrorHookResult = z.infer<
  typeof ListToolsErrorHookResultSchema
>;
export type InitializeErrorHookResult = z.infer<
  typeof InitializeErrorHookResultSchema
>;
export type OtherErrorHookResult = z.infer<typeof OtherErrorHookResultSchema>;
export type TargetErrorHookResult = z.infer<typeof TargetErrorHookResultSchema>;
export type NotificationErrorHookResult = z.infer<
  typeof NotificationErrorHookResultSchema
>;
export type TargetNotificationErrorHookResult = z.infer<
  typeof TargetNotificationErrorHookResultSchema
>;
export type ListPromptsRequestHookResult =
  | z.infer<typeof ListPromptsRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: ListPromptsRequestWithContext;
      response: ListPromptsResult;
      callback: (
        response: ListPromptsResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ListPromptsResponseHookResult = z.infer<
  typeof ListPromptsResponseHookResultSchema
>;
export type ListToolsRequestHookResult =
  | z.infer<typeof ListToolsRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: ListToolsRequestWithContext;
      response: ListToolsResult;
      callback: (
        response: ListToolsResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ListToolsResponseHookResult = z.infer<
  typeof ListToolsResponseHookResultSchema
>;
export type InitializeRequestHookResult =
  | z.infer<typeof InitializeRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: InitializeRequestWithContext;
      response: InitializeResult;
      callback: (
        response: InitializeResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type InitializeResponseHookResult = z.infer<
  typeof InitializeResponseHookResultSchema
>;
export type RequestHookResult =
  | z.infer<typeof RequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: Request;
      response: Result;
      callback: (
        response: Result | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ResponseHookResult = z.infer<typeof ResponseHookResultSchema>;
export type NotificationHookResult = z.infer<
  typeof NotificationHookResultSchema
>;
export type ListResourcesRequestHookResult =
  | z.infer<typeof ListResourcesRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: ListResourcesRequestWithContext;
      response: ListResourcesResult;
      callback: (
        response: ListResourcesResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ListResourcesResponseHookResult = z.infer<
  typeof ListResourcesResponseHookResultSchema
>;
export type ListResourcesErrorHookResult = z.infer<
  typeof ListResourcesErrorHookResultSchema
>;
export type ListResourceTemplatesRequestHookResult =
  | z.infer<typeof ListResourceTemplatesRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: ListResourceTemplatesRequestWithContext;
      response: ListResourceTemplatesResult;
      callback: (
        response: ListResourceTemplatesResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ListResourceTemplatesResponseHookResult = z.infer<
  typeof ListResourceTemplatesResponseHookResultSchema
>;
export type ListResourceTemplatesErrorHookResult = z.infer<
  typeof ListResourceTemplatesErrorHookResultSchema
>;
export type ReadResourceRequestHookResult =
  | z.infer<typeof ReadResourceRequestHookResultSchema>
  | {
      resultType: "continueAsync";
      request: ReadResourceRequestWithContext;
      response: ReadResourceResult;
      callback: (
        response: ReadResourceResult | null,
        error: HookChainError | null,
      ) => Promise<void>;
    };
export type ReadResourceResponseHookResult = z.infer<
  typeof ReadResourceResponseHookResultSchema
>;
export type ReadResourceErrorHookResult = z.infer<
  typeof ReadResourceErrorHookResultSchema
>;

/**
 * Extra data provided to request handlers in hooks.
 * Mirrors fields from MCP SDK's RequestHandlerExtra.
 */
export type RequestExtra = {
  /**
   * The session ID from the transport, if available.
   */
  sessionId?: string;

  /**
   * The JSON-RPC ID of the request being handled.
   * This can be useful for tracking or logging purposes.
   */
  requestId: RequestId;

  /**
   * Information about a validated access token, provided to request handlers.
   */
  authInfo?: AuthInfo;

  /**
   * Metadata from the original request.
   */
  _meta?: RequestMeta;

  /**
   * The original HTTP request.
   */
  requestInfo?: RequestInfo;
};

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
    requestExtra: RequestExtra,
  ): Promise<CallToolRequestHookResult>;

  /**
   * Process a tool call response
   */
  processCallToolResult?(
    result: CallToolResult,
    originalCallToolRequest: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolResponseHookResult>;

  /**
   * Process errors for tool calls (optional)
   */
  processCallToolError?(
    error: HookChainError,
    originalToolCall: CallToolRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<CallToolErrorHookResult>;
  /**
   * Process a prompts/list request (optional)
   */
  processListPromptsRequest?(
    request: ListPromptsRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<ListPromptsRequestHookResult>;

  /**
   * Process a prompts/list response (optional)
   */
  processListPromptsResult?(
    result: ListPromptsResult,
    originalListPromptsRequest: ListPromptsRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsResponseHookResult>;

  /**
   * Process errors for prompts/list requests (optional)
   */
  processListPromptsError?(
    error: HookChainError,
    originalRequest: ListPromptsRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListPromptsErrorHookResult>;

  /**
   * Process a tools/list request (optional)
   */
  processListToolsRequest?(
    request: ListToolsRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<ListToolsRequestHookResult>;

  /**
   * Process a tools/list response (optional)
   */
  processListToolsResult?(
    result: ListToolsResult,
    originalListToolsRequest: ListToolsRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsResponseHookResult>;

  /**
   * Process errors for tools/list requests (optional)
   */
  processListToolsError?(
    error: HookChainError,
    originalRequest: ListToolsRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListToolsErrorHookResult>;

  /**
   * Process an initialize request (optional)
   */
  processInitializeRequest?(
    request: InitializeRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<InitializeRequestHookResult>;

  /**
   * Process an initialize response (optional)
   */
  processInitializeResult?(
    result: InitializeResult,
    originalInitializeRequest: InitializeRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeResponseHookResult>;

  /**
   * Process errors for initialize requests (optional)
   */
  processInitializeError?(
    error: HookChainError,
    originalRequest: InitializeRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<InitializeErrorHookResult>;

  /**
   * Process a request from the client NOT covered by a dedicated handler (optional)
   */
  processOtherRequest?(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult>;

  /**
   * Process a reponse from the client NOT covered by a dedicated handler (optional)
   */
  processOtherResult?(
    result: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult>;

  /**
   * Process errors for other requests (optional)
   */
  processOtherError?(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<OtherErrorHookResult>;

  /**
   * Process a target request (request coming from the target server back to the client) (optional)
   */
  processTargetRequest?(
    request: Request,
    requestExtra: RequestExtra,
  ): Promise<RequestHookResult>;

  /**
   * Process a target response (response going back to the target server) (optional)
   */
  processTargetResult?(
    result: Result,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<ResponseHookResult>;

  /**
   * Process errors for target requests (optional)
   */
  processTargetError?(
    error: HookChainError,
    originalRequest: Request,
    originalRequestExtra: RequestExtra,
  ): Promise<TargetErrorHookResult>;

  /**
   * Process a resources/list request (optional)
   */
  processListResourcesRequest?(
    request: ListResourcesRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<ListResourcesRequestHookResult>;

  /**
   * Process a resources/list response (optional)
   */
  processListResourcesResult?(
    result: ListResourcesResult,
    originalListToolsRequest: ListResourcesRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesResponseHookResult>;

  /**
   * Process errors for resources/list requests (optional)
   */
  processListResourcesError?(
    error: HookChainError,
    originalRequest: ListResourcesRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourcesErrorHookResult>;

  /**
   * Process a resources/templates/list request (optional)
   */
  processListResourceTemplatesRequest?(
    request: ListResourceTemplatesRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesRequestHookResult>;

  /**
   * Process a resources/templates/list response (optional)
   */
  processListResourceTemplatesResult?(
    result: ListResourceTemplatesResult,
    originalListToolsRequest: ListResourceTemplatesRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesResponseHookResult>;

  /**
   * Process errors for resources/templates/list requests (optional)
   */
  processListResourceTemplatesError?(
    error: HookChainError,
    originalRequest: ListResourceTemplatesRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ListResourceTemplatesErrorHookResult>;

  /**
   * Process a resources/read request (optional)
   */
  processReadResourceRequest?(
    request: ReadResourceRequestWithContext,
    requestExtra: RequestExtra,
  ): Promise<ReadResourceRequestHookResult>;

  /**
   * Process a resources/read response (optional)
   */
  processReadResourceResult?(
    result: ReadResourceResult,
    originalListToolsRequest: ReadResourceRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceResponseHookResult>;

  /**
   * Process errors for resources/read requests (optional)
   */
  processReadResourceError?(
    error: HookChainError,
    originalRequest: ReadResourceRequestWithContext,
    originalRequestExtra: RequestExtra,
  ): Promise<ReadResourceErrorHookResult>;

  /**
   * Process a notification (notification from client to target server) (optional)
   */
  processNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult>;

  /**
   * Process errors for notifications (optional)
   */
  processNotificationError?(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<NotificationErrorHookResult>;

  /**
   * Process a target notification (notification from target server to client) (optional)
   */
  processTargetNotification?(
    notification: Notification,
  ): Promise<NotificationHookResult>;

  /**
   * Process errors for target notifications (optional)
   */
  processTargetNotificationError?(
    error: HookChainError,
    originalNotification: Notification,
  ): Promise<TargetNotificationErrorHookResult>;
}

/**
 * Generic TypeScript types for hook results
 */

/**
 * Generic type for request hook results
 * - continue: Continue with potentially modified request
 * - respond: Return response directly without forwarding
 * - continueAsync: Continue with modified request, return immediate response, and register callback for actual response
 */
export type GenericRequestHookResult<TRequest, TResponse> =
  | { resultType: "continue"; request: TRequest }
  | { resultType: "respond"; response: TResponse }
  | ({
      resultType: "continueAsync";
      request: TRequest;
      response: TResponse;
    } & {
      callback: (
        response: TResponse | null,
        error: HookChainError | null,
      ) => Promise<void>;
    });

/**
 * Generic type for response hook results
 * - continue: Continue with potentially modified response
 */
export type GenericResponseHookResult<TResponse> = {
  resultType: "continue";
  response: TResponse;
};

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
      | ((request: infer R, requestExtra: RequestExtra) => unknown)
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
          originalRequestExtra: RequestExtra,
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
export type MethodsWithErrorType<TRequest> = Exclude<
  {
    [K in keyof Hook]: Hook[K] extends
      | ((
          error: HookChainError,
          originalRequest: infer R,
          originalRequestExtra: RequestExtra,
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
