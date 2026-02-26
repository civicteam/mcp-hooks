import {
  AbstractHook,
  type CallToolErrorHookResult,
  type CallToolRequestHookResult,
  type CallToolResponseHookResult,
  type HookChainError,
  type ListToolsResponseHookResult,
} from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const PLAYWRIGHT_RUN_CODE_TOOL = "browser_run_code";
const CHEAP_TOOL_NAME = "run_code_cheap";
const CHEAP_META_FLAG = "run_code_cheap";

const CHEAP_TOOL_DESCRIPTION =
  "Token-saving wrapper around browser_run_code. Use this by default. " +
  "Your code should return { success: true } when the operation succeeded. " +
  "Any throw, invalid return shape, or { success: false } is treated as failure.";

const FULL_RESULTS_NOTE =
  "Use this only when you need full Playwright output. " +
  "Otherwise prefer run_code_cheap to save tokens.";

const STATUS_SENTINEL_KEY = "__run_code_cheap_status";
const STATUS_SUCCESS = "success";
const STATUS_FAILURE = "failure";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function withDescriptionNote(
  description: string | undefined,
  note: string,
): string {
  if (!description || description.trim() === "") {
    return note;
  }

  if (description.includes(note)) {
    return description;
  }

  return `${description}\n\n${note}`;
}

function buildStatusResponse(success: boolean): CallToolResult {
  const text = success ? STATUS_SUCCESS : STATUS_FAILURE;

  return {
    isError: !success,
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent: {
      success,
    },
  };
}

function buildWrappedCode(userCode: string): string {
  const escapedCode = JSON.stringify(userCode);

  return [
    "async (page) => {",
    `  const __statusKey = ${JSON.stringify(STATUS_SENTINEL_KEY)};`,
    "  const __status = (value) => ({ [__statusKey]: value });",
    `  const __userCode = ${escapedCode};`,
    "",
    "  let __userFn;",
    "  try {",
    "    __userFn = (0, eval)('(' + __userCode + ')');",
    "    if (typeof __userFn !== 'function') {",
    `      return __status(${JSON.stringify(STATUS_FAILURE)});`,
    "    }",
    "  } catch (_error) {",
    `    return __status(${JSON.stringify(STATUS_FAILURE)});`,
    "  }",
    "",
    "  try {",
    "    const __result = await __userFn(page);",
    "    if (",
    "      __result &&",
    "      typeof __result === 'object' &&",
    "      'success' in __result &&",
    "      __result.success === true",
    "    ) {",
    `      return __status(${JSON.stringify(STATUS_SUCCESS)});`,
    "    }",
    `    return __status(${JSON.stringify(STATUS_FAILURE)});`,
    "  } catch (_error) {",
    `    return __status(${JSON.stringify(STATUS_FAILURE)});`,
    "  }",
    "}",
  ].join("\n");
}

function extractStatusFromResponse(response: CallToolResult): boolean {
  if (response.isError === true) {
    return false;
  }

  for (const contentItem of response.content) {
    if (
      contentItem.type === "text" &&
      "text" in contentItem &&
      typeof contentItem.text === "string"
    ) {
      const text = contentItem.text;

      if (
        new RegExp(
          `${STATUS_SENTINEL_KEY}"\\s*:\\s*"${STATUS_SUCCESS}"`,
          "i",
        ).test(text)
      ) {
        return true;
      }

      if (
        new RegExp(
          `${STATUS_SENTINEL_KEY}"\\s*:\\s*"${STATUS_FAILURE}"`,
          "i",
        ).test(text)
      ) {
        return false;
      }

      if (/"success"\s*:\s*true/i.test(text)) {
        return true;
      }

      if (/"success"\s*:\s*false/i.test(text)) {
        return false;
      }
    }
  }

  return false;
}

function isRunCodeCheapCall(request: CallToolRequest): boolean {
  if (!isObject(request.params._meta)) {
    return false;
  }

  return request.params._meta[CHEAP_META_FLAG] === true;
}

function markAsRunCodeCheap(request: CallToolRequest): CallToolRequest {
  const existingMeta = isObject(request.params._meta)
    ? request.params._meta
    : {};

  return {
    ...request,
    params: {
      ...request.params,
      _meta: {
        ...existingMeta,
        [CHEAP_META_FLAG]: true,
      },
    },
  };
}

export class PlaywrightTokenSaverHook extends AbstractHook {
  get name(): string {
    return "PlaywrightTokenSaverHook";
  }

  async processListToolsResult(
    response: ListToolsResult,
    _originalRequest: ListToolsRequest,
  ): Promise<ListToolsResponseHookResult> {
    const runCodeTool = response.tools.find(
      (tool) => tool.name === PLAYWRIGHT_RUN_CODE_TOOL,
    );

    const toolsWithHints: Tool[] = response.tools.map((tool) => {
      if (!tool.name.startsWith("browser_") || tool.name === CHEAP_TOOL_NAME) {
        return tool;
      }

      return {
        ...tool,
        description: withDescriptionNote(tool.description, FULL_RESULTS_NOTE),
      };
    });

    if (
      !runCodeTool ||
      toolsWithHints.some((tool) => tool.name === CHEAP_TOOL_NAME)
    ) {
      return {
        resultType: "continue",
        response: {
          ...response,
          tools: toolsWithHints,
        },
      };
    }

    const cheapTool: Tool = {
      ...runCodeTool,
      name: CHEAP_TOOL_NAME,
      description: CHEAP_TOOL_DESCRIPTION,
    };

    return {
      resultType: "continue",
      response: {
        ...response,
        tools: [...toolsWithHints, cheapTool],
      },
    };
  }

  async processCallToolRequest(
    request: CallToolRequest,
  ): Promise<CallToolRequestHookResult> {
    if (request.params.name !== CHEAP_TOOL_NAME) {
      return {
        resultType: "continue",
        request,
      };
    }

    const requestArguments = request.params.arguments;

    if (
      !isObject(requestArguments) ||
      typeof requestArguments.code !== "string"
    ) {
      return {
        resultType: "respond",
        response: buildStatusResponse(false),
      };
    }

    const rewrittenRequest = markAsRunCodeCheap({
      ...request,
      params: {
        ...request.params,
        name: PLAYWRIGHT_RUN_CODE_TOOL,
        arguments: {
          ...requestArguments,
          code: buildWrappedCode(requestArguments.code),
        },
      },
    });

    return {
      resultType: "continue",
      request: rewrittenRequest,
    };
  }

  async processCallToolResult(
    response: CallToolResult,
    originalCallToolRequest: CallToolRequest,
  ): Promise<CallToolResponseHookResult> {
    if (!isRunCodeCheapCall(originalCallToolRequest)) {
      return {
        resultType: "continue",
        response,
      };
    }

    const success = extractStatusFromResponse(response);

    return {
      resultType: "continue",
      response: buildStatusResponse(success),
    };
  }

  async processCallToolError(
    _error: HookChainError,
    originalCallToolRequest: CallToolRequest,
  ): Promise<CallToolErrorHookResult> {
    if (!isRunCodeCheapCall(originalCallToolRequest)) {
      return {
        resultType: "continue",
      };
    }

    return {
      resultType: "respond",
      response: buildStatusResponse(false),
    };
  }
}
