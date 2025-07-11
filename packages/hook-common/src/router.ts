import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  ListToolsRequestHookResultSchema,
  ListToolsResponseHookResultSchema,
  ToolCallRequestHookResultSchema,
  ToolCallResponseHookResultSchema,
  TransportErrorSchema,
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
 * Full router type with all procedures
 */
export const fullRouter = t.router({
  ...baseRouter._def.procedures,
  ...toolsListRouter._def.procedures,
});

export type HookRouter = typeof fullRouter;

/**
 * Create a hook router for a given hook implementation
 */
export function createHookRouter(hook: Hook) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedures need flexible typing
  const procedures: any = {
    processToolCallRequest: t.procedure
      .input(CallToolRequestSchema)
      .output(ToolCallRequestHookResultSchema)
      .mutation(async ({ input }) => {
        return await hook.processToolCallRequest(input);
      }),

    processToolCallResponse: t.procedure
      .input(
        z.object({
          response: z.any(),
          originalToolCall: CallToolRequestSchema,
        }),
      )
      .output(ToolCallResponseHookResultSchema)
      .mutation(async ({ input }) => {
        return await hook.processToolCallResponse(
          input.response,
          input.originalToolCall,
        );
      }),
  };

  // Add optional procedures if the hook supports them
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

  if (hook.processToolCallTransportError) {
    procedures.processToolCallTransportError = t.procedure
      .input(
        z.object({
          error: TransportErrorSchema,
          originalToolCall: CallToolRequestSchema,
        }),
      )
      .output(
        z.discriminatedUnion("resultType", [
          z.object({
            resultType: z.literal("abort"),
            reason: z.string(),
          }),
          z.object({
            resultType: z.literal("continue"),
            error: TransportErrorSchema,
          }),
        ]),
      )
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolCallTransportError) {
          throw new Error("processToolCallTransportError not implemented");
        }
        return await hook.processToolCallTransportError(
          input.error,
          input.originalToolCall,
        );
      });
  }

  if (hook.processToolsListTransportError) {
    procedures.processToolsListTransportError = t.procedure
      .input(
        z.object({
          error: TransportErrorSchema,
          originalRequest: ListToolsRequestSchema,
        }),
      )
      .output(
        z.discriminatedUnion("resultType", [
          z.object({
            resultType: z.literal("abort"),
            reason: z.string(),
          }),
          z.object({
            resultType: z.literal("continue"),
            error: TransportErrorSchema,
          }),
        ]),
      )
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolsListTransportError) {
          throw new Error("processToolsListTransportError not implemented");
        }
        return await hook.processToolsListTransportError(
          input.error,
          input.originalRequest,
        );
      });
  }

  return t.router(procedures);
}
