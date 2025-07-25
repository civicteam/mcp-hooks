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
  GenericTransportErrorHookResult,
  Hook,
  MethodsWithRequestType,
  MethodsWithResponseType,
  MethodsWithTransportErrorType,
  TransportError,
} from "@civic/hook-common";

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
  hooks: Hook[],
  methodName: TMethodName,
): Promise<
  GenericRequestHookResult<TRequest, TResponse> & { lastProcessedIndex: number }
> {
  let currentRequest = request;
  let lastProcessedIndex = -1;

  console.log(
    `[Processor] Processing request through ${hooks.length} hooks for method ${methodName}`,
  );
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    const hookMethod = hook[methodName];

    // Why runtime checks despite TypeScript constraints:
    // - Hook methods are optional in the interface
    // - A hook might not implement every possible method
    // - TypeScript ensures methodName is valid, but not that every hook has it
    if (!hookMethod || typeof hookMethod !== "function") {
      console.log(
        `[Processor] Skipping hook ${hook.name} - no method ${methodName}`,
      );
      continue;
    }

    console.log(`Processing hook ${hook.name} for method ${methodName}`);

    // Why use .call():
    // - Ensures 'this' context is properly bound to the hook instance
    // - Allows hooks to access their own properties/state via 'this'
    const hookResult = await hookMethod.call(hook, currentRequest);
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      // Hook may have modified the request - use the updated version
      currentRequest = hookResult.request;
    } else if (hookResult.resultType === "respond") {
      // Why early return with response:
      // - Hook has provided a direct response, bypassing the actual server
      // - Useful for caching, mocking, or synthetic responses
      return { ...hookResult, lastProcessedIndex };
    } else {
      // abort case
      // Why abort exists:
      // - Security hooks need to block dangerous operations
      // - Validation hooks need to reject malformed requests
      // - Rate limiting hooks need to stop excessive requests
      return { ...hookResult, lastProcessedIndex };
    }
  }

  return {
    resultType: "continue",
    request: currentRequest,
    lastProcessedIndex,
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
 * Why startIndex instead of processing all hooks:
 * - Only hooks that processed the request should process the response
 * - If hook 3 of 5 aborted the request, hooks 4-5 never saw it
 * - Starting from lastProcessedIndex ensures proper pairing
 */
export async function processResponseThroughHooks<
  TRequest,
  TResponse,
  TMethodName extends MethodsWithResponseType<TResponse, TRequest>,
>(
  response: TResponse,
  originalRequest: TRequest,
  hooks: Hook[],
  startIndex: number,
  methodName: TMethodName,
): Promise<
  GenericResponseHookResult<TResponse> & { lastProcessedIndex: number }
> {
  let currentResponse = response;
  let lastProcessedIndex = startIndex;

  // Why iterate backwards from startIndex:
  // - Ensures symmetric processing (first to see request = last to see response)
  // - Maintains transformation nesting (unwrap in reverse order of wrapping)
  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];
    const hookMethod = hook[methodName];

    if (!hookMethod || typeof hookMethod !== "function") {
      continue;
    }

    const hookResult = await hookMethod.call(
      hook,
      currentResponse,
      originalRequest,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentResponse = hookResult.response;
    } else {
      // abort - even responses can be rejected
      // Why: A hook might detect sensitive data in response that shouldn't be exposed
      return { ...hookResult, lastProcessedIndex };
    }
  }

  return {
    resultType: "continue",
    response: currentResponse,
    lastProcessedIndex,
  };
}

/**
 * Process transport errors through hooks in reverse order
 *
 * Why handle transport errors separately:
 * - Network failures and server errors need different handling than protocol errors
 * - Transport errors occur outside the normal request/response flow
 * - Examples: Connection timeouts, 5xx errors, DNS failures
 *
 * Why hooks might want to process transport errors:
 * - Retry logic: Hook can retry failed requests with backoff
 * - Failover: Switch to backup servers on specific error codes
 * - Error transformation: Convert technical errors to user-friendly messages
 * - Circuit breaking: Stop cascading failures by failing fast
 * - Monitoring: Track error rates and alert on anomalies
 *
 * Why reverse order (same as response processing):
 * - Maintains the middleware pattern consistency
 * - Hooks that initiated actions can clean up on errors
 * - Example: A hook that started a transaction can roll it back
 */
// Helper type to extract the return type of a hook method
type ExtractHookMethodReturnType<T> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

// Helper type to extract the response type from a transport error hook result
type ExtractTransportErrorResponseType<T> = T extends {
  resultType: "respond";
  response: infer R;
}
  ? R
  : never;

export async function processTransportErrorThroughHooks<
  TRequest,
  TMethodName extends MethodsWithTransportErrorType<TRequest>,
  THookResult = ExtractHookMethodReturnType<Hook[TMethodName]>,
  TResponse = ExtractTransportErrorResponseType<THookResult>,
>(
  error: TransportError,
  originalRequest: TRequest,
  hooks: Hook[],
  startIndex: number,
  methodName: TMethodName,
): Promise<
  GenericTransportErrorHookResult<TResponse> & { lastProcessedIndex: number }
> {
  let currentError = error;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];
    const hookMethod = hook[methodName];

    if (!hookMethod || typeof hookMethod !== "function") {
      continue;
    }

    const hookResult = await hookMethod.call(
      hook,
      currentError,
      originalRequest,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      // Why allow error transformation:
      // - Hooks can enhance error messages with context
      // - Sanitize sensitive data from error messages
      // - Add request correlation IDs for debugging
      currentError = hookResult.error;
    } else if (hookResult.resultType === "abort") {
      // abort - hook is suppressing the error
      // Why: Some errors might be expected and shouldn't propagate
      // Example: 404s for optional resources
      return { ...hookResult, lastProcessedIndex };
    } else if (hookResult.resultType === "respond") {
      // respond - hook has handled the error and provided a response
      // Why: Hook may have retried the request successfully
      // Example: Authentication hook retrying after refreshing tokens
      return { ...hookResult, lastProcessedIndex };
    }
  }

  return {
    resultType: "continue",
    error: currentError,
    lastProcessedIndex,
  };
}
