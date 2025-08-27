import type { RequestExtra } from "@civic/hook-common";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Notification, Request } from "@modelcontextprotocol/sdk/types.js";

/**
 * Maps RequestHandlerExtra from the MCP SDK to RequestExtra for hooks.
 * This utility ensures all relevant fields are properly transferred.
 */
export function mapRequestHandlerExtraToRequestExtra<
  SendRequestT extends Request,
  SendNotificationT extends Notification,
>(
  requestHandlerExtra: RequestHandlerExtra<SendRequestT, SendNotificationT>,
): RequestExtra {
  return {
    requestId: requestHandlerExtra.requestId,
    sessionId: requestHandlerExtra.sessionId,
    authInfo: requestHandlerExtra.authInfo,
    _meta: requestHandlerExtra._meta,
    requestInfo: requestHandlerExtra.requestInfo,
  };
}
