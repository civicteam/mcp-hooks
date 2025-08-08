import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  InitializeRequestHookResultSchema,
  InitializeResponseHookResultSchema,
  ListToolsRequestHookResultSchema,
  ListToolsResponseHookResultSchema,
  ToolCallRequestHookResultSchema,
  ToolCallResponseHookResultSchema,
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
  processToolCallRequest: t.procedure
    .input(CallToolRequestSchema)
    .output(ToolCallRequestHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processRequest not implemented");
    }),

  /**
   * Process a tool call response
   */
  processToolCallResponse: t.procedure
    .input(
      z.object({
        response: z.any(),
        originalToolCall: CallToolRequestSchema,
      }),
    )
    .output(ToolCallResponseHookResultSchema)
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
  processToolsListRequest: t.procedure
    .input(ListToolsRequestSchema)
    .output(ListToolsRequestHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processToolsListRequest not implemented");
    }),

  /**
   * Process a tools/list response
   */
  processToolsListResponse: t.procedure
    .input(
      z.object({
        response: ListToolsResultSchema,
        originalRequest: ListToolsRequestSchema,
      }),
    )
    .output(ListToolsResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processToolsListResponse not implemented");
    }),

  /**
   * Process an exception during tool execution
   */
  processToolException: t.procedure
    .input(
      z.object({
        error: z.any(),
        originalToolCall: CallToolRequestSchema,
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
    .input(InitializeRequestSchema)
    .output(InitializeRequestHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processInitializeRequest not implemented");
    }),

  /**
   * Process initialize responses
   */
  processInitializeResponse: t.procedure
    .input(
      z.object({
        response: InitializeResultSchema,
        originalRequest: InitializeRequestSchema,
      }),
    )
    .output(InitializeResponseHookResultSchema)
    .mutation(async ({ input }) => {
      throw new Error("processInitializeResponse not implemented");
    }),
});

/**
 * Full router type with all procedures
 */
const fullRouter = t.router({
  ...baseRouter._def.procedures,
  ...toolsListRouter._def.procedures,
  ...initializeRouter._def.procedures,
});

export type HookRouter = typeof fullRouter;

/**
 * Create a hook router for a given hook implementation
 */
export function createHookRouter(hook: Hook) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedures need flexible typing
  const procedures: any = {};

  // Add processToolCallRequest if the hook implements it
  if (hook.processToolCallRequest) {
    procedures.processToolCallRequest = t.procedure
      .input(CallToolRequestSchema)
      .output(ToolCallRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolCallRequest) {
          throw new Error("processToolCallRequest not implemented");
        }
        return await hook.processToolCallRequest(input);
      });
  }

  // Add processToolCallResponse if the hook implements it
  if (hook.processToolCallResponse) {
    procedures.processToolCallResponse = t.procedure
      .input(
        z.object({
          response: z.any(),
          originalToolCall: CallToolRequestSchema,
        }),
      )
      .output(ToolCallResponseHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolCallResponse) {
          throw new Error("processToolCallResponse not implemented");
        }
        return await hook.processToolCallResponse(
          input.response,
          input.originalToolCall,
        );
      });
  }

  if (hook.processToolsListRequest) {
    procedures.processToolsListRequest = t.procedure
      .input(ListToolsRequestSchema)
      .output(ListToolsRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolsListRequest) {
          throw new Error("processToolsListRequest not implemented");
        }
        return await hook.processToolsListRequest(input);
      });
  }

  if (hook.processToolsListResponse) {
    procedures.processToolsListResponse = t.procedure
      .input(
        z.object({
          response: ListToolsResultSchema,
          originalRequest: ListToolsRequestSchema,
        }),
      )
      .output(ListToolsResponseHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolsListResponse) {
          throw new Error("processToolsListResponse not implemented");
        }
        return await hook.processToolsListResponse(
          input.response,
          input.originalRequest,
        );
      });
  }

  // Add processInitializeRequest if the hook implements it
  if (hook.processInitializeRequest) {
    procedures.processInitializeRequest = t.procedure
      .input(InitializeRequestSchema)
      .output(InitializeRequestHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeRequest) {
          throw new Error("processInitializeRequest not implemented");
        }
        return await hook.processInitializeRequest(input);
      });
  }

  // Add processInitializeResponse if the hook implements it
  if (hook.processInitializeResponse) {
    procedures.processInitializeResponse = t.procedure
      .input(
        z.object({
          response: InitializeResultSchema,
          originalRequest: InitializeRequestSchema,
        }),
      )
      .output(InitializeResponseHookResultSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processInitializeResponse) {
          throw new Error("processInitializeResponse not implemented");
        }
        return await hook.processInitializeResponse(
          input.response,
          input.originalRequest,
        );
      });
  }

  return t.router(procedures);
}
