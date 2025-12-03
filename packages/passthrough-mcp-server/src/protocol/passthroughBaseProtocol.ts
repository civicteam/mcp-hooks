import type { RequestContext } from "@civic/hook-common";
import type {
  AnySchema,
  SchemaOutput,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { safeParse } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import {
  DEFAULT_REQUEST_TIMEOUT_MSEC,
  Protocol,
  type ProtocolOptions,
  type RequestHandlerExtra,
  type RequestOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  ErrorCode,
  type JSONRPCRequest,
  McpError,
  type Notification,
  type Request,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import {
  CancelledNotificationSchema,
  PingRequestSchema,
  ProgressNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

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

  protected assertTaskCapability(): void {
    // accept all
  }

  protected assertTaskHandlerCapability(): void {
    // accept all
  }

  constructor(
    requestHandler: (
      request: Request,
      requestHandlerExtra: RequestHandlerExtra<SendRequestT, SendNotificationT>,
    ) => Promise<SendResultT>,
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

  /**
   * Crude overwrite of request function to consider requestContext
   *
   * Do not use this method to emit notifications! Use notification() instead.
   */
  override request<T extends AnySchema>(
    requestWithContext: SendRequestT & { requestContext?: RequestContext }, // extended with type
    resultSchema: T,
    options?: RequestOptions,
  ): Promise<SchemaOutput<T>> {
    const { relatedRequestId, resumptionToken, onresumptiontoken } =
      options ?? {};

    return new Promise((resolve, reject) => {
      if (!this.transport) {
        reject(new Error("Not connected"));
        return;
      }

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
      if ((this as any)._options?.enforceStrictCapabilities === true) {
        this.assertCapabilityForMethod(requestWithContext.method);
      }

      options?.signal?.throwIfAborted();

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
      const messageId = (this as any)._requestMessageId++;

      // Extract requestContext before creating JSON-RPC request
      const { requestContext, ...request } = requestWithContext;

      const jsonrpcRequest: JSONRPCRequest = {
        ...request,
        jsonrpc: "2.0",
        id: messageId,
      };

      if (options?.onprogress) {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
        (this as any)._progressHandlers.set(messageId, options.onprogress);
        jsonrpcRequest.params = {
          ...request.params,
          _meta: {
            ...(request.params?._meta || {}),
            progressToken: messageId,
          },
        };
      }

      const cancel = (reason: unknown) => {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
        (this as any)._responseHandlers.delete(messageId);
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
        (this as any)._progressHandlers.delete(messageId);
        // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
        (this as any)._cleanupTimeout(messageId);

        // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
        (this as any)._transport
          ?.send(
            {
              jsonrpc: "2.0",
              method: "notifications/cancelled",
              params: {
                requestId: messageId,
                reason: String(reason),
              },
            },
            { relatedRequestId, resumptionToken, onresumptiontoken },
          )
          // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
          .catch((error: any) =>
            // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
            (this as any)._onerror(
              new Error(`Failed to send cancellation: ${error}`),
            ),
          );

        reject(reason);
      };

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
      // biome-ignore lint/suspicious/noExplicitAny: Response type from Protocol internals
      (this as any)._responseHandlers.set(messageId, (response: any) => {
        if (options?.signal?.aborted) {
          return;
        }

        if (response instanceof Error) {
          return reject(response);
        }

        const parseResult = safeParse(resultSchema, response.result);
        if (parseResult.success) {
          resolve(parseResult.data);
        } else {
          reject(parseResult.error);
        }
      });

      options?.signal?.addEventListener("abort", () => {
        cancel(options?.signal?.reason);
      });

      const timeout = options?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
      const timeoutHandler = () =>
        cancel(
          new McpError(ErrorCode.RequestTimeout, "Request timed out", {
            timeout,
          }),
        );

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
      (this as any)._setupTimeout(
        messageId,
        timeout,
        options?.maxTotalTimeout,
        timeoutHandler,
        options?.resetTimeoutOnProgress ?? false,
      );

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
      (this as any)._transport
        .send(jsonrpcRequest, {
          relatedRequestId,
          resumptionToken,
          onresumptiontoken,
          requestContext,
        })
        // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
        .catch((error: any) => {
          // biome-ignore lint/suspicious/noExplicitAny: Accessing private Protocol member
          (this as any)._cleanupTimeout(messageId);
          reject(error);
        });
    });
  }
}
