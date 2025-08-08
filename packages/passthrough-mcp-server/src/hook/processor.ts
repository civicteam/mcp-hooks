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
  MethodsWithRequestType,
  MethodsWithResponseType,
} from "@civic/hook-common";
import { logger } from "../logger/logger.js";
import type { LinkedListHook } from "./hookChain.js";

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
  head: LinkedListHook | null, // null : empty hook-chain,
  methodName: TMethodName,
): Promise<
  GenericRequestHookResult<TRequest, TResponse> & {
    lastProcessedHook: LinkedListHook | null;
  }
> {
  let currentRequest = request;
  let currentHook = head;

  logger.debug(
    `[Processor] Processing request through hooks for method ${methodName}`,
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
      continue;
    }

    logger.debug(`Processing hook ${hook.name} for method ${methodName}`);

    // Why use .call():
    // - Ensures 'this' context is properly bound to the hook instance
    // - Allows hooks to access their own properties/state via 'this'
    const hookResult = await hookMethod.call(hook, currentRequest);

    if (hookResult.resultType === "continue") {
      // Hook may have modified the request - use the updated version
      currentRequest = hookResult.request;
    } else if (hookResult.resultType === "respond") {
      // Why early return with response:
      // - Hook has provided a direct response, bypassing the actual server
      // - Useful for caching, mocking, or synthetic responses
      return { ...hookResult, lastProcessedHook: currentHook };
    } else {
      // abort case
      // Why abort exists:
      // - Security hooks need to block dangerous operations
      // - Validation hooks need to reject malformed requests
      // - Rate limiting hooks need to stop excessive requests
      return { ...hookResult, lastProcessedHook: currentHook };
    }

    if (currentHook.next) {
      currentHook = currentHook.next;
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
 * Process a response through hooks in reverse order
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
 */
export async function processResponseThroughHooks<
  TRequest,
  TResponse,
  TMethodName extends MethodsWithResponseType<TResponse, TRequest>,
>(
  response: TResponse,
  originalRequest: TRequest,
  last: LinkedListHook | null, // null : empty hook-chain
  methodName: TMethodName,
): Promise<
  GenericResponseHookResult<TResponse> & {
    lastProcessedHook: LinkedListHook | null;
  }
> {
  let currentResponse = response;
  let currentHook = last;

  // Why iterate backwards from startIndex:
  // - Ensures symmetric processing (first to see request = last to see response)
  // - Maintains transformation nesting (unwrap in reverse order of wrapping)
  while (currentHook) {
    const hook = currentHook.hook;
    const hookMethod = hook[methodName];

    if (!hookMethod || typeof hookMethod !== "function") {
      continue;
    }

    const hookResult = await hookMethod.call(
      hook,
      currentResponse,
      originalRequest,
    );

    if (hookResult.resultType === "continue") {
      currentResponse = hookResult.response;
    } else {
      // abort - even responses can be rejected
      // Why: A hook might detect sensitive data in response that shouldn't be exposed
      return { ...hookResult, lastProcessedHook: currentHook };
    }

    if (currentHook.previous) {
      currentHook = currentHook.previous;
    } else {
      break;
    }
  }

  return {
    resultType: "continue",
    response: currentResponse,
    lastProcessedHook: currentHook,
  };
}
