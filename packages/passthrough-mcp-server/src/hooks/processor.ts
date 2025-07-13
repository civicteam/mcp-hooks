/**
 * Hook Processor Module
 *
 * Handles processing of tool calls through hook chains
 */

import type {
  Hook,
  InitializeRequest,
  InitializeTransportErrorHookResult,
  ListToolsRequestHookResult,
  ListToolsResponseHookResult,
  ListToolsTransportErrorHookResult,
  ToolCallRequestHookResult,
  ToolCallResponseHookResult,
  ToolCallTransportErrorHookResult,
  TransportError,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../lib/logger.js";

/**
 * Process a tool call through a chain of hooks for request validation
 */
export async function processRequestThroughHooks(
  toolCall: CallToolRequest,
  hooks: Hook[],
): Promise<ToolCallRequestHookResult & { lastProcessedIndex: number }> {
  let currentRequest = toolCall;
  let lastProcessedIndex = -1;

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];

    logger.info(
      `Processing request through hook ${i + 1} (${hook.name}) for tool '${currentRequest.params.name}'`,
    );

    const hookResult = await hook.processToolCallRequest(currentRequest);
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentRequest = hookResult.request;
      logger.info(
        `Hook ${i + 1} approved request for tool '${currentRequest.params.name}'`,
      );
    } else if (hookResult.resultType === "respond") {
      logger.info(
        `Hook ${i + 1} handled request directly for tool '${currentRequest.params.name}'`,
      );
      return { ...hookResult, lastProcessedIndex };
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} rejected request: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue
  return {
    resultType: "continue",
    request: currentRequest,
    lastProcessedIndex,
  };
}

/**
 * Process a response through a chain of hooks in reverse order
 */
export async function processResponseThroughHooks(
  response: CallToolResult,
  toolCall: CallToolRequest,
  hooks: Hook[],
  startIndex: number,
): Promise<ToolCallResponseHookResult & { lastProcessedIndex: number }> {
  let currentResponse = response;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    logger.info(
      `Processing response through hook ${i + 1} (${hook.name}) for tool '${toolCall.params.name}'`,
    );

    const hookResult = await hook.processToolCallResponse(
      currentResponse,
      toolCall,
    );
    lastProcessedIndex = i;
    logger.info(`Response from hook: ${JSON.stringify(hookResult, null, 2)}`);

    if (hookResult.resultType === "continue") {
      currentResponse = hookResult.response;
      logger.info(
        `Hook ${i + 1} approved response for tool '${toolCall.params.name}'`,
      );
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} rejected response: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue
  return {
    resultType: "continue",
    response: currentResponse,
    lastProcessedIndex,
  };
}

/**
 * Process a tools/list request through a chain of hooks
 */
export async function processToolsListRequestThroughHooks(
  request: ListToolsRequest,
  hooks: Hook[],
): Promise<ListToolsRequestHookResult & { lastProcessedIndex: number }> {
  let currentRequest = request;
  let lastProcessedIndex = -1;

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];

    // Check if hook supports tools/list processing
    if (!hook.processToolsListRequest) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tools/list processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tools/list request through hook ${i + 1} (${hook.name})`,
    );

    const hookResult = await hook.processToolsListRequest(currentRequest);
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentRequest = hookResult.request;
      logger.info(`Hook ${i + 1} approved tools/list request`);
    } else if (hookResult.resultType === "respond") {
      return { ...hookResult, lastProcessedIndex };
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} rejected tools/list request: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue
  return {
    resultType: "continue",
    request: currentRequest,
    lastProcessedIndex,
  };
}

/**
 * Process a tools/list response through a chain of hooks in reverse order
 */
export async function processToolsListResponseThroughHooks(
  response: ListToolsResult,
  request: ListToolsRequest,
  hooks: Hook[],
  startIndex: number,
): Promise<ListToolsResponseHookResult & { lastProcessedIndex: number }> {
  let currentResponse = response;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    // Check if hook supports tools/list response processing
    if (!hook.processToolsListResponse) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tools/list response processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tools/list response through hook ${i + 1} (${hook.name})`,
    );

    const hookResult = await hook.processToolsListResponse(
      currentResponse,
      request,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentResponse = hookResult.response;
      logger.info(`Hook ${i + 1} approved tools/list response`);
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} rejected tools/list response: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue
  return {
    resultType: "continue",
    response: currentResponse,
    lastProcessedIndex,
  };
}

/**
 * Process a tool call transport error through a chain of hooks in reverse order
 */
export async function processToolCallTransportErrorThroughHooks(
  error: TransportError,
  toolCall: CallToolRequest,
  hooks: Hook[],
  startIndex: number,
): Promise<ToolCallTransportErrorHookResult & { lastProcessedIndex: number }> {
  let currentError = error;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    // Check if hook supports transport error processing
    if (!hook.processToolCallTransportError) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tool call transport error processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tool call transport error through hook ${i + 1} (${hook.name})`,
    );

    const hookResult = await hook.processToolCallTransportError(
      currentError,
      toolCall,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentError = hookResult.error;
      logger.info(`Hook ${i + 1} passed error through`);
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} aborted error processing: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue with final error
  return {
    resultType: "continue",
    error: currentError,
    lastProcessedIndex,
  };
}

/**
 * Process a tools/list transport error through a chain of hooks in reverse order
 */
export async function processToolsListTransportErrorThroughHooks(
  error: TransportError,
  request: ListToolsRequest,
  hooks: Hook[],
  startIndex: number,
): Promise<ListToolsTransportErrorHookResult & { lastProcessedIndex: number }> {
  let currentError = error;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    // Check if hook supports transport error processing
    if (!hook.processToolsListTransportError) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tools/list transport error processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tools/list transport error through hook ${i + 1} (${hook.name})`,
    );

    const hookResult = await hook.processToolsListTransportError(
      currentError,
      request,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentError = hookResult.error;
      logger.info(`Hook ${i + 1} passed error through`);
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} aborted error processing: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue with final error
  return {
    resultType: "continue",
    error: currentError,
    lastProcessedIndex,
  };
}
/**
 * Process an initialize transport error through a chain of hooks in reverse order
 */
export async function processInitializeTransportErrorThroughHooks(
  error: TransportError,
  request: InitializeRequest,
  hooks: Hook[],
  startIndex: number,
): Promise<
  InitializeTransportErrorHookResult & { lastProcessedIndex: number }
> {
  let currentError = error;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    // Check if hook supports transport error processing
    if (!hook.processInitializeTransportError) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support initialize transport error processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing initialize transport error through hook ${i + 1} (${hook.name})`,
    );

    const hookResult = await hook.processInitializeTransportError(
      currentError,
      request,
    );
    lastProcessedIndex = i;

    if (hookResult.resultType === "continue") {
      currentError = hookResult.error;
      logger.info(`Hook ${i + 1} passed error through`);
    } else {
      // abort
      logger.info(
        `Hook ${i + 1} aborted error processing: ${hookResult.reason || "No reason provided"}`,
      );
      return { ...hookResult, lastProcessedIndex };
    }
  }

  // All hooks passed, return continue with final error
  return {
    resultType: "continue",
    error: currentError,
    lastProcessedIndex,
  };
}
