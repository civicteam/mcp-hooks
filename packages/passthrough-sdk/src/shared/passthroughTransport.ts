import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { PassthroughContext } from "./passthroughContext.js";

export interface PassthroughTransport extends Transport {
  /**
   * Reference to the PassthroughContext this transport belongs to.
   * Set when the transport is added to a context.
   */
  context?: PassthroughContext;
}

export interface ClientPassthroughTransport extends PassthroughTransport {
  /**
   * Type identifier for client transports
   */
  readonly type: "client";
}

export interface ServerPassthroughTransport extends PassthroughTransport {
  /**
   * Type identifier for server transports
   */
  readonly type: "server";
}
