import { Protocol } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ProtocolOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import {
  CancelledNotificationSchema,
  PingRequestSchema,
  ProgressNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

export abstract class PassthroughBaseProtocol<
  SendRequestT extends Request,
  SendNotificationT extends Notification,
  SendResultT extends Result,
> extends Protocol<SendRequestT, SendNotificationT, SendResultT> {
  protected assertCapabilityForMethod(method: SendRequestT["method"]): void {
    // accept all
  }

  protected assertNotificationCapability(
    method: SendNotificationT["method"],
  ): void {
    // accept all
  }

  protected assertRequestHandlerCapability(method: string): void {
    // accept all
  }

  constructor(
    requestHandler: (request: Request) => Promise<SendResultT>,
    notificationHandler: (notification: Notification) => Promise<void>,
    options?: ProtocolOptions,
  ) {
    super(options);
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

  // We overwrite the original connect method, since we DO NOT want to generate and send any messages.
  override async connect(transport: Transport): Promise<void> {
    await super.connect(transport);
  }
}
