/**
 * Hook Processor Module
 *
 * This module implements the core hook processing pipeline that allows
 * multiple hooks to inspect, modify, or intercept MCP protocol messages.
 *
 * Why this architecture:
 * 1. Hook chains provide a composable way to add cross-cutting concerns
 *    (logging, security, rate limiting) without modifying core logic
 * 2. The pipeline pattern allows hooks to cooperate - each hook can
 *    decide to continue, abort, or provide a direct response
 * 3. Generic functions with type constraints ensure compile-time safety
 *    while maintaining runtime flexibility for optional hook methods
 */

import type {
  GenericRequestHookResult,
  GenericResponseHookResult,
  Hook,
  HookChainError,
  MethodsWithErrorType,
  MethodsWithRequestType,
  MethodsWithResponseType,
  NotificationHookResult,
  RequestExtra,
} from "@civic/hook-common";
import {
  ErrorCode,
  type Notification,
} from "@modelcontextprotocol/sdk/types.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../logger/logger.js";
import type { LinkedListHook } from "./hookChain.js";

/**
 * Maps any error type to a HookChainError
 *
 * Handles:
 * - McpError: Preserves error code and message
 * - Error: Uses standard internal error code with message
 * - HookChainError: Returns as-is
 * - Other types: Converts to string with internal error code
 *
 * @param e The error to convert
 * @returns A properly formatted HookChainError
 */
export function toHookChainError(e: unknown): HookChainError {
  // If it's already a HookChainError, return as-is
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e &&
    typeof (e as Record<string, unknown>).code === "number" &&
    typeof (e as Record<string, unknown>).message === "string"
  ) {
    return e as HookChainError;
  }

  // Handle McpError specifically
  if (e instanceof McpError) {
    return {
      code: e.code,
      message: e.message,
      data: e.data,
    };
  }

  // Handle standard Error
  if (e instanceof Error) {
    return {
      code: ErrorCode.InternalError, // Internal error
      message: e.message,
      data: {
        name: e.name,
        stack: e.stack,
      },
    };
  }

  // Handle objects that might have error-like properties
  if (typeof e === "object" && e !== null) {
    const obj = e as Record<string, unknown>;
    return {
      code: typeof obj.code === "number" ? obj.code : -32603,
      message: typeof obj.message === "string" ? obj.message : String(e),
      data: e,
    };
  }

  // Fallback for primitives and other types
  return {
    code: -32603, // Internal error
    message: String(e),
  };
}

/**
 * Extended request hook result that includes abort case for backward compatibility
 * Hooks throw errors, but the processor catches them and converts to abort
 */
export type ProcessorRequestHookResult<TRequest, TResponse> = (
  | GenericRequestHookResult<TRequest, TResponse>
  | { resultType: "abort"; error: HookChainError }
) & {
  lastProcessedHook: LinkedListHook | null;
};

/**
 * Extended response hook result that includes abort case for backward compatibility
 * Hooks throw errors, but the processor catches them and converts to abort
 */
export type ProcessorResponseHookResult<TResponse> =
  | GenericResponseHookResult<TResponse>
  | { resultType: "abort"; error: HookChainError };

/**
 * Extended Notification hook result that includes abort case for backward compatibility
 * Hooks throw errors, but the processor catches them and converts to abort
 */
export type ProcessorNotificationHookResult =
  | NotificationHookResult
  | { resultType: "abort"; error: HookChainError };

/**
 * Process a request through a chain of hooks
 *
 * Why generic type constraints:
 * - TRequest/TResponse ensure type safety across the pipeline
 * - TMethodName extends MethodsWithRequestType<TRequest> ensures we can only
 *   call hook methods that accept the specific request type we're processing
 * - This prevents runtime errors from calling incompatible methods
 *
 * Why lastProcessedIndex:
 * - Response hooks need to run in reverse order (like middleware)
 * - We track which hooks processed the request so we know where to start
 *   when processing the response
 * - This ensures each hook's response processor pairs with its request processor
 */
export async function processRequestThroughHooks<
  TRequest,
  TResponse,
  TMethodName extends MethodsWithRequestType<TRequest>,
>(
  request: TRequest,
  requestExtra: RequestExtra,
  startHook: LinkedListHook | null, // null: empty hook-chain, can be head or tail
  methodName: TMethodName,
  direction: "forward" | "reverse" = "forward", // forward: head->tail, reverse: tail->head
): Promise<ProcessorRequestHookResult<TRequest, TResponse>> {
  let currentRequest = request;
  let currentHook = startHook;

  logger.debug(
    `[Processor] Processing request through hooks ${direction === "reverse" ? "in REVERSE " : ""}for method ${methodName}`,
  );
  while (currentHook) {
    const hook = currentHook.hook;
    const hookMethod = hook[methodName];

    // Why runtime checks despite TypeScript constraints:
    // - Hook methods are optional in the interface
    // - A hook might not implement every possible method
    // - TypeScript ensures methodName is valid, but not that every hook has it
    if (!hookMethod || typeof hookMethod !== "function") {
      logger.debug(
        `[Processor] Skipping hook ${hook.name} - no method ${methodName}`,
      );
      // Move to next hook based on direction
      if (direction === "forward" && currentHook.next) {
        currentHook = currentHook.next;
      } else if (direction === "reverse" && currentHook.previous) {
        currentHook = currentHook.previous;
      } else {
        break;
      }
      continue;
    }

    logger.debug(`Processing hook ${hook.name} for method ${methodName}`);

    // Why use .call():
    // - Ensures 'this' context is properly bound to the hook instance
    // - Allows hooks to access their own properties/state via 'this'
    // Type assertion needed because TypeScript can't correlate the generic
    // methodName with the specific method signature at compile time
    try {
      const hookResult = await (
        hookMethod as (
          request: TRequest,
          requestExtra: RequestExtra,
        ) => Promise<GenericRequestHookResult<TRequest, TResponse>>
      ).call(hook, currentRequest, requestExtra);

      if (hookResult.resultType === "continue") {
        // Hook may have modified the request - use the updated version
        currentRequest = hookResult.request;
      } else {
        // hookResult.resultType === "respond"
        // Why early return with response:
        // - Hook has provided a direct response, bypassing the actual server
        // - Useful for caching, mocking, or synthetic responses
        return { ...hookResult, lastProcessedHook: currentHook };
      }
    } catch (e) {
      // Convert thrown errors to abort result for backward compatibility
      const error = toHookChainError(e);
      logger.debug(`Hook ${hook.name} threw error: ${error.message}`);
      return {
        resultType: "abort",
        error,
        lastProcessedHook: currentHook,
      };
    }

    // Move to next hook based on direction
    if (direction === "forward" && currentHook.next) {
      currentHook = currentHook.next;
    } else if (direction === "reverse" && currentHook.previous) {
      currentHook = currentHook.previous;
    } else {
      break;
    }
  }

  return {
    resultType: "continue",
    request: currentRequest,
    lastProcessedHook: currentHook,
  };
}

/**
 * Process a response or exception through hooks in reverse order
 *
 * This function can handle both successful responses and errors/exceptions.
 * When an error is provided, it attempts to call error processing methods first,
 * and if a hook recovers from the error (returns a response), it switches to
 * response processing for subsequent hooks.
 *
 * Why reverse order:
 * - Follows the middleware pattern (like Express.js or Koa)
 * - Hooks that transform requests should untransform responses
 * - Example: Hook A adds auth header, Hook B encrypts body
 *   Request: A→B→Server, Response: Server→B→A
 * - This ensures proper nesting of transformations
 *
 * Why originalRequest parameter:
 * - Response hooks often need context from the original request
 * - Example: A caching hook needs the request URL to store the response
 * - Example: An audit hook needs to log request-response pairs together
 *
 * @param responseOrError Either a response object or an error to process
 * @param originalRequest The original request that led to this response/error
 * @param originalRequestExtra Additional request context
 * @param startHook The hook to start processing from
 * @param responseMethodName The method name for processing responses
 * @param errorMethodName The method name for processing errors (optional)
 * @param direction Processing direction through the hook chain
 */
export async function processResponseThroughHooks<
  TRequest,
  TResponse,
  TResponseMethodName extends MethodsWithResponseType<TResponse, TRequest>,
  TErrorMethodName extends MethodsWithErrorType<TRequest>,
>(
  response: TResponse | null,
  error: HookChainError | null,
  originalRequest: TRequest,
  originalRequestExtra: RequestExtra,
  startHook: LinkedListHook | null,
  responseMethodName: TResponseMethodName,
  errorMethodName: TErrorMethodName,
  direction: "forward" | "reverse" = "reverse",
): Promise<ProcessorResponseHookResult<TResponse>> {
  let currentResponse = response;
  let currentError = error;

  if (!currentError && !currentResponse) {
    currentError = {
      code: ErrorCode.InternalError, // Internal error
      message:
        "processResponseThroughHooks was called without a response OR error",
    };
  }

  let currentHook = startHook;

  // Why iterate backwards from startIndex:
  // - Ensures symmetric processing (first to see request = last to see response)
  // - Maintains transformation nesting (unwrap in reverse order of wrapping)
  while (currentHook) {
    const hook = currentHook.hook;
    // Type assertion needed because TypeScript can't correlate the generic
    // methodName with the specific method signature at compile time
    try {
      const hookMethod = currentError
        ? hook[errorMethodName]
        : hook[responseMethodName];

      if (!hookMethod || typeof hookMethod !== "function") {
        // Move to next hook
        if (direction === "forward" && currentHook.next) {
          currentHook = currentHook.next;
        } else if (direction === "reverse" && currentHook.previous) {
          currentHook = currentHook.previous;
        } else {
          break;
        }
        continue;
      }

      let hookResult: GenericResponseHookResult<TResponse>;
      if (currentError) {
        hookResult = await (
          hookMethod as (
            error: HookChainError,
            request: TRequest,
            requestExtra: RequestExtra,
          ) => Promise<GenericResponseHookResult<TResponse>>
        ).call(hook, currentError, originalRequest, originalRequestExtra);

        if (hookResult.resultType === "continue") {
          // continue with current error
          throw currentError;
        }
      } else {
        hookResult = await (
          hookMethod as (
            response: TResponse,
            request: TRequest,
            requestExtra: RequestExtra,
          ) => Promise<GenericResponseHookResult<TResponse>>
        ).call(
          hook,
          currentResponse as TResponse,
          originalRequest,
          originalRequestExtra,
        );
      }

      // The functions can only return a new response or throw
      currentResponse = hookResult.response;
      currentError = null;
    } catch (e) {
      // Convert thrown errors to abort result for backward compatibility
      currentError = toHookChainError(e);
      currentResponse = null;
    }

    if (direction === "forward" && currentHook.next) {
      currentHook = currentHook.next;
    } else if (direction === "reverse" && currentHook.previous) {
      currentHook = currentHook.previous;
    } else {
      break;
    }
  }

  if (currentResponse) {
    return {
      resultType: "continue",
      response: currentResponse,
    };
  }
  return {
    resultType: "abort",
    error: currentError as HookChainError,
  };
}

/**
 * Process a notification through a chain of hooks
 *
 * Why this exists:
 * - Notifications are fire-and-forget messages that don't expect responses
 * - Hooks can inspect, modify, or block notifications
 * - Unlike requests/responses, there's no response phase for notifications
 *
 * Why simpler than request/response:
 * - No response handling needed (notifications are one-way)
 * - No need to track lastProcessedHook (no reverse processing)
 * - Can only abort or continue, not respond (no response to return)
 *
 * @param notification The notification to process
 * @param startHook The first hook in the chain (or null for empty chain)
 * @param methodName The hook method to call (e.g., "processNotification")
 * @param direction The direction in which the list should be traversed
 * @returns Result indicating whether to continue or abort
 */
export async function processNotificationThroughHooks<
  TMethodName extends keyof Hook,
>(
  notification: Notification,
  startHook: LinkedListHook | null,
  methodName: TMethodName,
  direction: "forward" | "reverse" = "forward", // forward: head->tail, reverse: tail->head
): Promise<ProcessorNotificationHookResult> {
  let currentNotification = notification;
  let currentHook = startHook;

  logger.debug(
    `[Processor] Processing notification through hooks for method ${String(methodName)}`,
  );

  while (currentHook) {
    const hook = currentHook.hook;
    const hookMethod = hook[methodName];

    // Skip hooks that don't implement this notification method
    if (!hookMethod || typeof hookMethod !== "function") {
      logger.debug(
        `[Processor] Skipping hook ${hook.name} - no method ${String(methodName)}`,
      );
      // Move to next hook based on direction
      if (direction === "forward") {
        currentHook = currentHook.next;
      } else {
        currentHook = currentHook.previous;
      }
      continue;
    }

    logger.debug(
      `Processing hook ${hook.name} for method ${String(methodName)}`,
    );

    // Type assertion needed because TypeScript can't correlate the generic
    // methodName with the specific method signature at compile time
    try {
      const hookResult = await (
        hookMethod as (
          notification: Notification,
        ) => Promise<NotificationHookResult>
      ).call(hook, currentNotification);

      currentNotification = hookResult.notification;
    } catch (e) {
      const error = toHookChainError(e);
      logger.debug(
        `[Processor] Hook ${hook.name} aborted notification: ${error.message}`,
      );
      return { resultType: "abort", error };
    }

    if (direction === "forward") {
      currentHook = currentHook.next;
    } else {
      // direction === "reverse"
      currentHook = currentHook.previous;
    }
  }

  return {
    resultType: "continue",
    notification: currentNotification,
  };
}
