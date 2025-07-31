import { Protocol } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  Notification,
  Request,
  Result,
  ServerNotification,
  ServerRequest,
  ServerResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  CancelledNotificationSchema,
  ClientResult,
  PingRequestSchema,
  ProgressNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PassthroughBaseProtocol } from "../protocol/passthroughBaseProtocol.js";

export class PassthroughServer<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends PassthroughBaseProtocol<
  ServerRequest | RequestT,
  ServerNotification | NotificationT,
  ServerResult | ResultT
> {}
