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

export class PassthroughClient<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends Protocol<
  ClientRequest | RequestT,
  ClientNotification | NotificationT,
  ClientResult | ResultT
> {
  protected assertCapabilityForMethod(
    method: (ClientRequest | RequestT)["method"],
  ): void {
    // accept all
  }

  protected assertNotificationCapability(
    method: (ClientNotification | NotificationT)["method"],
  ): void {
    // accept all
  }

  protected assertRequestHandlerCapability(method: string): void {
    // accept all
  }

  constructor(
    requestHandler: (request: Request) => Promise<ClientResult | ResultT>,
    notificationHandler: (notification: Notification) => Promise<void>,
  ) {
    super();
    // remove any custom request and notification handlers that might be setup by the protocol by default
    // TODO: Consider if we should reimplement Protocol instead
    this.removeNotificationHandler(
      CancelledNotificationSchema.shape.method.value,
    );
    this.removeNotificationHandler(
      ProgressNotificationSchema.shape.method.value,
    );
    this.removeRequestHandler(PingRequestSchema.shape.method.value);

    this.fallbackRequestHandler = requestHandler;
    this.fallbackNotificationHandler = notificationHandler;
  }

  // We overwrite the original connect method, since we DO NOT want to send an "Initialize" to the server.
  override async connect(
    transport: Transport,
    options?: RequestOptions,
  ): Promise<void> {
    await super.connect(transport);
  }
}
