/**
 * Hook Processor Module
 *
 * Handles processing of tool calls through hook chains
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
 * Generic function to process a request through a chain of hooks
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

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    const hookMethod = hook[methodName];

    // If the hook does not implement the method, skip it
    if (!hookMethod || typeof hookMethod !== "function") continue;

    const hookResult = await hookMethod.call(hook, currentRequest);
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentRequest = hookResult.request;
    } else if (hookResult.resultType === "respond") {
      return { ...hookResult, lastProcessedIndex };
    } else {
      // abort
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
 * Generic function to process a response through a chain of hooks in reverse order
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
      // abort
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
 * Generic function to process a transport error through a chain of hooks in reverse order
 */
export async function processTransportErrorThroughHooks<
  TRequest,
  TMethodName extends MethodsWithTransportErrorType<TRequest>,
>(
  error: TransportError,
  originalRequest: TRequest,
  hooks: Hook[],
  startIndex: number,
  methodName: TMethodName,
): Promise<GenericTransportErrorHookResult & { lastProcessedIndex: number }> {
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
      currentError = hookResult.error;
    } else {
      // abort
      return { ...hookResult, lastProcessedIndex };
    }
  }

  return {
    resultType: "continue",
    error: currentError,
    lastProcessedIndex,
  };
}
