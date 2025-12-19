import {
  CallToolRequestSchema,
  InitializeResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ListToolsResultSchema,
  NotificationSchema,
  ReadResourceResultSchema,
  RequestSchema,
  ResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { Hook } from "./types.js";
import {
  CallToolErrorHookResultSchema,
  CallToolRequestHookResultSchema,
  CallToolRequestSchemaWithContext,
  CallToolResponseHookResultSchema,
  HookChainErrorSchema,
  InitializeErrorHookResultSchema,
  InitializeRequestHookResultSchema,
  InitializeRequestSchemaWithContext,
  InitializeResponseHookResultSchema,
  ListPromptsErrorHookResultSchema,
  ListPromptsRequestHookResultSchema,
  ListPromptsRequestSchemaWithContext,
  ListPromptsResponseHookResultSchema,
  ListResourcesErrorHookResultSchema,
  ListResourcesRequestHookResultSchema,
  ListResourcesRequestSchemaWithContext,
  ListResourcesResponseHookResultSchema,
  ListResourceTemplatesErrorHookResultSchema,
  ListResourceTemplatesRequestHookResultSchema,
  ListResourceTemplatesRequestSchemaWithContext,
  ListResourceTemplatesResponseHookResultSchema,
  ListToolsErrorHookResultSchema,
  ListToolsRequestHookResultSchema,
  ListToolsRequestSchemaWithContext,
  ListToolsResponseHookResultSchema,
  NotificationErrorHookResultSchema,
  NotificationHookResultSchema,
  OtherErrorHookResultSchema,
  ReadResourceErrorHookResultSchema,
  ReadResourceRequestHookResultSchema,
  ReadResourceRequestSchemaWithContext,
  ReadResourceResponseHookResultSchema,
  RequestHookResultSchema,
  ResponseHookResultSchema,
  TargetErrorHookResultSchema,
  TargetNotificationErrorHookResultSchema,
} from "./types.js";

/**
 * Create a tRPC instance with SuperJSON for serialization
 */
const t = initTRPC.create({
  transformer: superjson,
});

/**
 * Base router procedures that all hooks must have
 */
const baseRouter = t.router({
  /**
   * Process an incoming tool call request
   */
  processCallToolRequest: t.procedure
    .input(
      z.object({
        request: CallToolRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(CallToolRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processRequest not implemented");
    }),

  /**
   * Process a tool call response
   */
  processCallToolResult: t.procedure
    .input(
      z.object({
        response: z.any(),
        originalCallToolRequest: CallToolRequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(CallToolResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processResponse not implemented");
    }),

  /**
   * Process errors for tool calls
   */
  processCallToolError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalToolCall: CallToolRequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(CallToolErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processCallToolError not implemented");
    }),
});

/**
 * Optional router procedures for tools/list
 */
const toolsListRouter = t.router({
  /**
   * Process a prompts/list request
   */
  processListPromptsRequest: t.procedure
    .input(
      z.object({
        request: ListPromptsRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(ListPromptsRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListPromptsRequest not implemented");
    }),
  /**
   * Process a prompts/list response
   */
  processListPromptsResult: t.procedure
    .input(
      z.object({
        response: ListPromptsResultSchema,
        originalRequest: ListPromptsRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListPromptsResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListPromptsResult not implemented");
    }),
  /**
   * Process errors for prompts/list requests
   */
  processListPromptsError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: ListPromptsRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListPromptsErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListPromptsError not implemented");
    }),
  /**
   * Process a tools/list request
   */
  processListToolsRequest: t.procedure
    .input(
      z.object({
        request: ListToolsRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(ListToolsRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListToolsRequest not implemented");
    }),

  /**
   * Process a tools/list response
   */
  processListToolsResult: t.procedure
    .input(
      z.object({
        response: ListToolsResultSchema,
        originalRequest: ListToolsRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListToolsResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListToolsResult not implemented");
    }),

  /**
   * Process errors for tools/list requests
   */
  processListToolsError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: ListToolsRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListToolsErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListToolsError not implemented");
    }),
});

/**
 * Initialize procedures router
 */
const initializeRouter = t.router({
  /**
   * Process initialize requests
   */
  processInitializeRequest: t.procedure
    .input(
      z.object({
        request: InitializeRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(InitializeRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processInitializeRequest not implemented");
    }),

  /**
   * Process initialize responses
   */
  processInitializeResult: t.procedure
    .input(
      z.object({
        response: InitializeResultSchema,
        originalRequest: InitializeRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(InitializeResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processInitializeResult not implemented");
    }),

  /**
   * Process errors for initialize requests
   */
  processInitializeError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: InitializeRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(InitializeErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processInitializeError not implemented");
    }),
});

/**
 * Resource router procedures
 */
const resourceRouter = t.router({
  /**
   * Process a resources/list request
   */
  processListResourcesRequest: t.procedure
    .input(
      z.object({
        request: ListResourcesRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(ListResourcesRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourcesRequest not implemented");
    }),

  /**
   * Process a resources/list response
   */
  processListResourcesResult: t.procedure
    .input(
      z.object({
        response: ListResourcesResultSchema,
        originalRequest: ListResourcesRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListResourcesResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourcesResult not implemented");
    }),

  /**
   * Process errors for resources/list requests
   */
  processListResourcesError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: ListResourcesRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListResourcesErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourcesError not implemented");
    }),

  /**
   * Process a resources/templates/list request
   */
  processListResourceTemplatesRequest: t.procedure
    .input(
      z.object({
        request: ListResourceTemplatesRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(ListResourceTemplatesRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourceTemplatesRequest not implemented");
    }),

  /**
   * Process a resources/templates/list response
   */
  processListResourceTemplatesResult: t.procedure
    .input(
      z.object({
        response: ListResourceTemplatesResultSchema,
        originalRequest: ListResourceTemplatesRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListResourceTemplatesResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourceTemplatesResult not implemented");
    }),

  /**
   * Process errors for resources/templates/list requests
   */
  processListResourceTemplatesError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: ListResourceTemplatesRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ListResourceTemplatesErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processListResourceTemplatesError not implemented");
    }),

  /**
   * Process a resources/read request
   */
  processReadResourceRequest: t.procedure
    .input(
      z.object({
        request: ReadResourceRequestSchemaWithContext,
        requestExtra: z.any(),
      }),
    )
    .output(ReadResourceRequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processReadResourceRequest not implemented");
    }),

  /**
   * Process a resources/read response
   */
  processReadResourceResult: t.procedure
    .input(
      z.object({
        response: ReadResourceResultSchema,
        originalRequest: ReadResourceRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ReadResourceResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processReadResourceResult not implemented");
    }),

  /**
   * Process errors for resources/read requests
   */
  processReadResourceError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: ReadResourceRequestSchemaWithContext,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ReadResourceErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processReadResourceError not implemented");
    }),
});

/**
 * Target and notification router procedures
 */
const targetAndNotificationRouter = t.router({
  /**
   * Process a request from the client NOT covered by a dedicated handler
   */
  processOtherRequest: t.procedure
    .input(
      z.object({
        request: RequestSchema,
        requestExtra: z.any(),
      }),
    )
    .output(RequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processOtherRequest not implemented");
    }),

  /**
   * Process a response from the client NOT covered by a dedicated handler
   */
  processOtherResult: t.procedure
    .input(
      z.object({
        response: ResultSchema,
        originalRequest: RequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processOtherResult not implemented");
    }),

  /**
   * Process errors for other requests
   */
  processOtherError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: RequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(OtherErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processOtherError not implemented");
    }),

  /**
   * Process a target request
   */
  processTargetRequest: t.procedure
    .input(
      z.object({
        request: RequestSchema,
        requestExtra: z.any(),
      }),
    )
    .output(RequestHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processTargetRequest not implemented");
    }),

  /**
   * Process a target response
   */
  processTargetResult: t.procedure
    .input(
      z.object({
        response: ResultSchema,
        originalRequest: RequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(ResponseHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processTargetResult not implemented");
    }),

  /**
   * Process errors for target requests
   */
  processTargetError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalRequest: RequestSchema,
        originalRequestExtra: z.any(),
      }),
    )
    .output(TargetErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processTargetError not implemented");
    }),

  /**
   * Process a notification
   */
  processNotification: t.procedure
    .input(NotificationSchema)
    .output(NotificationHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processNotification not implemented");
    }),

  /**
   * Process errors for notifications
   */
  processNotificationError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalNotification: NotificationSchema,
      }),
    )
    .output(NotificationErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processNotificationError not implemented");
    }),

  /**
   * Process a target notification
   */
  processTargetNotification: t.procedure
    .input(NotificationSchema)
    .output(NotificationHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processTargetNotification not implemented");
    }),

  /**
   * Process errors for target notifications
   */
  processTargetNotificationError: t.procedure
    .input(
      z.object({
        error: HookChainErrorSchema,
        originalNotification: NotificationSchema,
      }),
    )
    .output(TargetNotificationErrorHookResultSchema)
    .mutation(async ({ input: _input }) => {
      throw new Error("processTargetNotificationError not implemented");
    }),
});

/**
 * Full router type with all procedures
 */
const fullRouter = t.router({
  ...baseRouter._def.procedures,
  ...toolsListRouter._def.procedures,
  ...initializeRouter._def.procedures,
  ...resourceRouter._def.procedures,
  ...targetAndNotificationRouter._def.procedures,
});

export type HookRouter = typeof fullRouter;

/**
 * Create a hook router for a given hook implementation
 */
export function createHookRouter(hook: Hook) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedures need flexible typing
  const procedures: any = {};

  // Add processCallToolRequest if the hook implements it
  if (hook.processCallToolRequest) {
    procedures.processCallToolRequest = t.procedure
      .input(
        z.object({
          request: CallToolRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(CallToolRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processCallToolRequest) {
          throw new Error("processCallToolRequest not implemented");
        }
        const result = await hook.processCallToolRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processCallToolResult if the hook implements it
  if (hook.processCallToolResult) {
    procedures.processCallToolResult = t.procedure
      .input(
        z.object({
          response: z.any(),
          originalCallToolRequest: CallToolRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(CallToolResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processCallToolResult) {
          throw new Error("processCallToolResult not implemented");
        }
        return await hook.processCallToolResult(
          input.response,
          input.originalCallToolRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processCallToolError if the hook implements it
  if (hook.processCallToolError) {
    procedures.processCallToolError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalToolCall: CallToolRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(CallToolErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processCallToolError) {
          throw new Error("processCallToolError not implemented");
        }
        return await hook.processCallToolError(
          input.error,
          input.originalToolCall,
          input.originalRequestExtra,
        );
      });
  }

  if (hook.processListPromptsRequest) {
    procedures.processListPromptsRequest = t.procedure
      .input(
        z.object({
          request: ListPromptsRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(ListPromptsRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListPromptsRequest) {
          throw new Error("processListPromptsRequest not implemented");
        }
        const result = await hook.processListPromptsRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }
  if (hook.processListPromptsResult) {
    procedures.processListPromptsResult = t.procedure
      .input(
        z.object({
          response: ListPromptsResultSchema,
          originalRequest: ListPromptsRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListPromptsResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListPromptsResult) {
          throw new Error("processListPromptsResult not implemented");
        }
        return await hook.processListPromptsResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }
  // Add processListPromptsError if the hook implements it
  if (hook.processListPromptsError) {
    procedures.processListPromptsError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: ListPromptsRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListPromptsErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListPromptsError) {
          throw new Error("processListPromptsError not implemented");
        }
        return await hook.processListPromptsError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }
  if (hook.processListToolsRequest) {
    procedures.processListToolsRequest = t.procedure
      .input(
        z.object({
          request: ListToolsRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(ListToolsRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListToolsRequest) {
          throw new Error("processListToolsRequest not implemented");
        }
        const result = await hook.processListToolsRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  if (hook.processListToolsResult) {
    procedures.processListToolsResult = t.procedure
      .input(
        z.object({
          response: ListToolsResultSchema,
          originalRequest: ListToolsRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListToolsResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListToolsResult) {
          throw new Error("processListToolsResult not implemented");
        }
        return await hook.processListToolsResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processListToolsError if the hook implements it
  if (hook.processListToolsError) {
    procedures.processListToolsError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: ListToolsRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListToolsErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListToolsError) {
          throw new Error("processListToolsError not implemented");
        }
        return await hook.processListToolsError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processInitializeRequest if the hook implements it
  if (hook.processInitializeRequest) {
    procedures.processInitializeRequest = t.procedure
      .input(
        z.object({
          request: InitializeRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(InitializeRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeRequest) {
          throw new Error("processInitializeRequest not implemented");
        }
        const result = await hook.processInitializeRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processInitializeResult if the hook implements it
  if (hook.processInitializeResult) {
    procedures.processInitializeResult = t.procedure
      .input(
        z.object({
          response: InitializeResultSchema,
          originalRequest: InitializeRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(InitializeResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeResult) {
          throw new Error("processInitializeResult not implemented");
        }
        return await hook.processInitializeResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processInitializeError if the hook implements it
  if (hook.processInitializeError) {
    procedures.processInitializeError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: InitializeRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(InitializeErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeError) {
          throw new Error("processInitializeError not implemented");
        }
        return await hook.processInitializeError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processOtherRequest if the hook implements it
  if (hook.processOtherRequest) {
    procedures.processOtherRequest = t.procedure
      .input(
        z.object({
          request: RequestSchema,
          requestExtra: z.any(),
        }),
      )
      .output(RequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processOtherRequest) {
          throw new Error("processOtherRequest not implemented");
        }
        const result = await hook.processOtherRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processOtherResult if the hook implements it
  if (hook.processOtherResult) {
    procedures.processOtherResult = t.procedure
      .input(
        z.object({
          response: ResultSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processOtherResult) {
          throw new Error("processOtherResult not implemented");
        }
        return await hook.processOtherResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processOtherError if the hook implements it
  if (hook.processOtherError) {
    procedures.processOtherError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: z.any(),
        }),
      )
      .output(OtherErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processOtherError) {
          throw new Error("processOtherError not implemented");
        }
        return await hook.processOtherError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processTargetRequest if the hook implements it
  if (hook.processTargetRequest) {
    procedures.processTargetRequest = t.procedure
      .input(
        z.object({
          request: RequestSchema,
          requestExtra: z.any(),
        }),
      )
      .output(RequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetRequest) {
          throw new Error("processTargetRequest not implemented");
        }
        const result = await hook.processTargetRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processTargetResult if the hook implements it
  if (hook.processTargetResult) {
    procedures.processTargetResult = t.procedure
      .input(
        z.object({
          response: ResultSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetResult) {
          throw new Error("processTargetResult not implemented");
        }
        return await hook.processTargetResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processTargetError if the hook implements it
  if (hook.processTargetError) {
    procedures.processTargetError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: z.any(),
        }),
      )
      .output(TargetErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetError) {
          throw new Error("processTargetError not implemented");
        }
        return await hook.processTargetError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processNotification if the hook implements it
  if (hook.processNotification) {
    procedures.processNotification = t.procedure
      .input(NotificationSchema)
      .output(NotificationHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processNotification) {
          throw new Error("processNotification not implemented");
        }
        return await hook.processNotification(input);
      });
  }

  // Add processNotificationError if the hook implements it
  if (hook.processNotificationError) {
    procedures.processNotificationError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalNotification: NotificationSchema,
        }),
      )
      .output(NotificationErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processNotificationError) {
          throw new Error("processNotificationError not implemented");
        }
        return await hook.processNotificationError(
          input.error,
          input.originalNotification,
        );
      });
  }

  // Add processTargetNotification if the hook implements it
  if (hook.processTargetNotification) {
    procedures.processTargetNotification = t.procedure
      .input(NotificationSchema)
      .output(NotificationHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetNotification) {
          throw new Error("processTargetNotification not implemented");
        }
        return await hook.processTargetNotification(input);
      });
  }

  // Add processTargetNotificationError if the hook implements it
  if (hook.processTargetNotificationError) {
    procedures.processTargetNotificationError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalNotification: NotificationSchema,
        }),
      )
      .output(TargetNotificationErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetNotificationError) {
          throw new Error("processTargetNotificationError not implemented");
        }
        return await hook.processTargetNotificationError(
          input.error,
          input.originalNotification,
        );
      });
  }

  // Add processListResourcesRequest if the hook implements it
  if (hook.processListResourcesRequest) {
    procedures.processListResourcesRequest = t.procedure
      .input(
        z.object({
          request: ListResourcesRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(ListResourcesRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourcesRequest) {
          throw new Error("processListResourcesRequest not implemented");
        }
        const result = await hook.processListResourcesRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processListResourcesResult if the hook implements it
  if (hook.processListResourcesResult) {
    procedures.processListResourcesResult = t.procedure
      .input(
        z.object({
          response: ListResourcesResultSchema,
          originalRequest: ListResourcesRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListResourcesResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourcesResult) {
          throw new Error("processListResourcesResult not implemented");
        }
        return await hook.processListResourcesResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processListResourcesError if the hook implements it
  if (hook.processListResourcesError) {
    procedures.processListResourcesError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: ListResourcesRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListResourcesErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourcesError) {
          throw new Error("processListResourcesError not implemented");
        }
        return await hook.processListResourcesError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processListResourceTemplatesRequest if the hook implements it
  if (hook.processListResourceTemplatesRequest) {
    procedures.processListResourceTemplatesRequest = t.procedure
      .input(
        z.object({
          request: ListResourceTemplatesRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(ListResourceTemplatesRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourceTemplatesRequest) {
          throw new Error(
            "processListResourceTemplatesRequest not implemented",
          );
        }
        const result = await hook.processListResourceTemplatesRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processListResourceTemplatesResult if the hook implements it
  if (hook.processListResourceTemplatesResult) {
    procedures.processListResourceTemplatesResult = t.procedure
      .input(
        z.object({
          response: ListResourceTemplatesResultSchema,
          originalRequest: ListResourceTemplatesRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListResourceTemplatesResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourceTemplatesResult) {
          throw new Error("processListResourceTemplatesResult not implemented");
        }
        return await hook.processListResourceTemplatesResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processListResourceTemplatesError if the hook implements it
  if (hook.processListResourceTemplatesError) {
    procedures.processListResourceTemplatesError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: ListResourceTemplatesRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ListResourceTemplatesErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListResourceTemplatesError) {
          throw new Error("processListResourceTemplatesError not implemented");
        }
        return await hook.processListResourceTemplatesError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processReadResourceRequest if the hook implements it
  if (hook.processReadResourceRequest) {
    procedures.processReadResourceRequest = t.procedure
      .input(
        z.object({
          request: ReadResourceRequestSchemaWithContext,
          requestExtra: z.any(),
        }),
      )
      .output(ReadResourceRequestHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processReadResourceRequest) {
          throw new Error("processReadResourceRequest not implemented");
        }
        const result = await hook.processReadResourceRequest(
          input.request,
          input.requestExtra,
        );
        if (result.resultType === "continueAsync") {
          throw new Error(
            "continueAsync is not supported for remote hooks via tRPC",
          );
        }
        return result;
      });
  }

  // Add processReadResourceResult if the hook implements it
  if (hook.processReadResourceResult) {
    procedures.processReadResourceResult = t.procedure
      .input(
        z.object({
          response: ReadResourceResultSchema,
          originalRequest: ReadResourceRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ReadResourceResponseHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processReadResourceResult) {
          throw new Error("processReadResourceResult not implemented");
        }
        return await hook.processReadResourceResult(
          input.response,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  // Add processReadResourceError if the hook implements it
  if (hook.processReadResourceError) {
    procedures.processReadResourceError = t.procedure
      .input(
        z.object({
          error: HookChainErrorSchema,
          originalRequest: ReadResourceRequestSchemaWithContext,
          originalRequestExtra: z.any(),
        }),
      )
      .output(ReadResourceErrorHookResultSchema)
      .mutation(async ({ input: _input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processReadResourceError) {
          throw new Error("processReadResourceError not implemented");
        }
        return await hook.processReadResourceError(
          input.error,
          input.originalRequest,
          input.originalRequestExtra,
        );
      });
  }

  return t.router(procedures);
}
