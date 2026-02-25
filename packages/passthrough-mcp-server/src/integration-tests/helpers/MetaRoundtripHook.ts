import type { RequestExtra } from "@civic/hook-common";

const META_FLAG = "test_request_modified";

/**
 * Test hook that verifies request hooks can communicate with their
 * corresponding response hooks via _meta flags.
 *
 * - processCallToolRequest: adds a _meta flag to the request
 * - processCallToolResult: checks for that flag and signals the result
 *   in the response content ("meta_flag_visible" or "meta_flag_missing")
 */
export const metaRoundtripHook = {
  get name() {
    return "MetaRoundtripHook";
  },
  async processCallToolRequest(request: any, _requestExtra: RequestExtra) {
    return {
      resultType: "continue" as const,
      request: {
        ...request,
        params: {
          ...request.params,
          _meta: {
            ...request.params._meta,
            [META_FLAG]: true,
          },
        },
      },
    };
  },
  async processCallToolResult(
    response: any,
    originalRequest: any,
    _requestExtra: RequestExtra,
  ) {
    const flagPresent = originalRequest.params?._meta?.[META_FLAG] === true;

    return {
      resultType: "continue" as const,
      response: {
        ...response,
        content: [
          {
            type: "text",
            text: flagPresent ? "meta_flag_visible" : "meta_flag_missing",
          },
        ],
      },
    };
  },
};
