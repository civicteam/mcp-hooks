import type {
  ClientNotification,
  ClientRequest,
  ClientResult,
  Notification,
  Request,
  Result,
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
