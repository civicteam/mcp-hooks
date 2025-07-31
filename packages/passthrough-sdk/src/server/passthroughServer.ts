import type {
  Notification,
  Request,
  Result,
  ServerNotification,
  ServerRequest,
  ServerResult,
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
