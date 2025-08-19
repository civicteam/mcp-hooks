import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  NotificationSchema,
  // NotificationSchema,
  RequestSchema,
  ResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  CallToolRequestHookResultSchema,
  CallToolResponseHookResultSchema,
  InitializeRequestHookResultSchema,
  InitializeResponseHookResultSchema,
  ListToolsRequestHookResultSchema,
  ListToolsResponseHookResultSchema,
  NotificationHookResultSchema,
  RequestExtraSchema,
  RequestHookResultSchema,
  ResponseHookResultSchema,
} from "./types.js";
import type { Hook } from "./types.js";

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
        request: CallToolRequestSchema,
        requestExtra: RequestExtraSchema,
      }),
    )
    .output(CallToolRequestHookResultSchema)
    .mutation(async ({ input }) => {
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
        originalRequestExtra: RequestExtraSchema,
      }),
    )
    .output(CallToolResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processResponse not implemented");
    }),
});

/**
 * Optional router procedures for tools/list
 */
const toolsListRouter = t.router({
  /**
   * Process a tools/list request
   */
  processListToolsRequest: t.procedure
    .input(
      z.object({
        request: ListToolsRequestSchema,
        requestExtra: RequestExtraSchema,
      }),
    )
    .output(ListToolsRequestHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processListToolsRequest not implemented");
    }),

  /**
   * Process a tools/list response
   */
  processListToolsResult: t.procedure
    .input(
      z.object({
        response: ListToolsResultSchema,
        originalRequest: ListToolsRequestSchema,
        originalRequestExtra: RequestExtraSchema,
      }),
    )
    .output(ListToolsResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processListToolsResult not implemented");
    }),

  /**
   * Process an exception during tool execution
   */
  processToolException: t.procedure
    .input(
      z.object({
        error: z.any(),
        originalCallToolRequest: CallToolRequestSchema,
      }),
    )
    .output(z.unknown())
    .mutation(async ({ input }) => {
      throw new Error("processToolException not implemented");
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
        request: InitializeRequestSchema,
        requestExtra: RequestExtraSchema,
      }),
    )
    .output(InitializeRequestHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processInitializeRequest not implemented");
    }),

  /**
   * Process initialize responses
   */
  processInitializeResult: t.procedure
    .input(
      z.object({
        response: InitializeResultSchema,
        originalRequest: InitializeRequestSchema,
        originalRequestExtra: RequestExtraSchema,
      }),
    )
    .output(InitializeResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processInitializeResult not implemented");
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
        requestExtra: RequestExtraSchema,
      }),
    )
    .output(RequestHookResultSchema)
    .mutation(async ({ input }) => {
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
        originalRequestExtra: RequestExtraSchema,
      }),
    )
    .output(ResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processOtherResult not implemented");
    }),

  /**
   * Process a target request
   */
  processTargetRequest: t.procedure
    .input(
      z.object({
        request: RequestSchema,
        requestExtra: RequestExtraSchema,
      }),
    )
    .output(RequestHookResultSchema)
    .mutation(async ({ input }) => {
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
        originalRequestExtra: RequestExtraSchema,
      }),
    )
    .output(ResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processTargetResult not implemented");
    }),

  /**
   * Process a notification
   */
  processNotification: t.procedure
    .input(NotificationSchema)
    .output(NotificationHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processNotification not implemented");
    }),

  /**
   * Process a target notification
   */
  processTargetNotification: t.procedure
    .input(NotificationSchema)
    .output(NotificationHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processTargetNotification not implemented");
    }),
});

/**
 * Full router type with all procedures
 */
const fullRouter = t.router({
  ...baseRouter._def.procedures,
  ...toolsListRouter._def.procedures,
  ...initializeRouter._def.procedures,
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
          request: CallToolRequestSchema,
          requestExtra: RequestExtraSchema,
        }),
      )
      .output(CallToolRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processCallToolRequest) {
          throw new Error("processCallToolRequest not implemented");
        }
        return await hook.processCallToolRequest(
          input.request,
          input.requestExtra,
        );
      });
  }

  // Add processCallToolResult if the hook implements it
  if (hook.processCallToolResult) {
    procedures.processCallToolResult = t.procedure
      .input(
        z.object({
          response: z.any(),
          originalCallToolRequest: CallToolRequestSchema,
          originalRequestExtra: RequestExtraSchema,
        }),
      )
      .output(CallToolResponseHookResultSchema)
      .mutation(async ({ input }) => {
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

  if (hook.processListToolsRequest) {
    procedures.processListToolsRequest = t.procedure
      .input(
        z.object({
          request: ListToolsRequestSchema,
          requestExtra: RequestExtraSchema,
        }),
      )
      .output(ListToolsRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processListToolsRequest) {
          throw new Error("processListToolsRequest not implemented");
        }
        return await hook.processListToolsRequest(
          input.request,
          input.requestExtra,
        );
      });
  }

  if (hook.processListToolsResult) {
    procedures.processListToolsResult = t.procedure
      .input(
        z.object({
          response: ListToolsResultSchema,
          originalRequest: ListToolsRequestSchema,
          originalRequestExtra: RequestExtraSchema,
        }),
      )
      .output(ListToolsResponseHookResultSchema)
      .mutation(async ({ input }) => {
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

  // Add processInitializeRequest if the hook implements it
  if (hook.processInitializeRequest) {
    procedures.processInitializeRequest = t.procedure
      .input(
        z.object({
          request: InitializeRequestSchema,
          requestExtra: RequestExtraSchema,
        }),
      )
      .output(InitializeRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeRequest) {
          throw new Error("processInitializeRequest not implemented");
        }
        return await hook.processInitializeRequest(
          input.request,
          input.requestExtra,
        );
      });
  }

  // Add processInitializeResult if the hook implements it
  if (hook.processInitializeResult) {
    procedures.processInitializeResult = t.procedure
      .input(
        z.object({
          response: InitializeResultSchema,
          originalRequest: InitializeRequestSchema,
          originalRequestExtra: RequestExtraSchema,
        }),
      )
      .output(InitializeResponseHookResultSchema)
      .mutation(async ({ input }) => {
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

  // Add processOtherRequest if the hook implements it
  if (hook.processOtherRequest) {
    procedures.processOtherRequest = t.procedure
      .input(
        z.object({
          request: RequestSchema,
          requestExtra: RequestExtraSchema,
        }),
      )
      .output(RequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processOtherRequest) {
          throw new Error("processOtherRequest not implemented");
        }
        return await hook.processOtherRequest(
          input.request,
          input.requestExtra,
        );
      });
  }

  // Add processOtherResult if the hook implements it
  if (hook.processOtherResult) {
    procedures.processOtherResult = t.procedure
      .input(
        z.object({
          response: ResultSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: RequestExtraSchema,
        }),
      )
      .output(ResponseHookResultSchema)
      .mutation(async ({ input }) => {
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

  // Add processTargetRequest if the hook implements it
  if (hook.processTargetRequest) {
    procedures.processTargetRequest = t.procedure
      .input(
        z.object({
          request: RequestSchema,
          requestExtra: RequestExtraSchema,
        }),
      )
      .output(RequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetRequest) {
          throw new Error("processTargetRequest not implemented");
        }
        return await hook.processTargetRequest(
          input.request,
          input.requestExtra,
        );
      });
  }

  // Add processTargetResult if the hook implements it
  if (hook.processTargetResult) {
    procedures.processTargetResult = t.procedure
      .input(
        z.object({
          response: ResultSchema,
          originalRequest: RequestSchema,
          originalRequestExtra: RequestExtraSchema,
        }),
      )
      .output(ResponseHookResultSchema)
      .mutation(async ({ input }) => {
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

  // Add processNotification if the hook implements it
  if (hook.processNotification) {
    procedures.processNotification = t.procedure
      .input(NotificationSchema)
      .output(NotificationHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processNotification) {
          throw new Error("processNotification not implemented");
        }
        return await hook.processNotification(input);
      });
  }

  // Add processTargetNotification if the hook implements it
  if (hook.processTargetNotification) {
    procedures.processTargetNotification = t.procedure
      .input(NotificationSchema)
      .output(NotificationHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processTargetNotification) {
          throw new Error("processTargetNotification not implemented");
        }
        return await hook.processTargetNotification(input);
      });
  }

  return t.router(procedures);
}
