import {
  Protocol,
  ProtocolOptions,
  type RequestOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CancelledNotificationSchema,
  type ClientNotification,
  type ClientRequest,
  type ClientResult,
  type Notification,
  PingRequestSchema,
  ProgressNotificationSchema,
  type Request,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { PassthroughBaseProtocol } from "../protocol/passthroughBaseProtocol.js";

export class PassthroughClient<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends PassthroughBaseProtocol<
  ClientRequest | RequestT,
  ClientNotification | NotificationT,
  ClientResult | ResultT
> {}
