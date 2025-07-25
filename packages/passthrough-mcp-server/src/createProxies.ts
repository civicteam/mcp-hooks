/**
 * Transport-specific factory functions for creating passthrough proxies
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Config } from "./lib/config.js";
import { HttpPassthroughProxyImpl } from "./server/http/httpPassthroughProxy.js";
import { StdioPassthroughProxyImpl } from "./server/stdio/stdioPassthroughProxy.js";
import { createTransportProxyServer } from "./server/transport/transportHandler.js";
import { TransportPassthroughProxyImpl } from "./server/transport/transportPassthroughProxy.js";
import type {
  HttpPassthroughProxy,
  PassthroughProxy,
  ServerPassthroughProxy,
} from "./types.js";

export type StdioProxyConfig = Omit<
  Config,
  "transportType" | "port" | "transport"
> & {
  autoStart?: boolean;
};

export type HttpProxyConfig = Omit<Config, "transportType" | "transport"> & {
  port: number;
  autoStart?: boolean;
};

export type TransportProxyConfig = Omit<Config, "transportType" | "port"> & {
  autoStart?: boolean;
  transport: Transport;
};

/**
 * Create a stdio passthrough proxy
 *
 * @param config Configuration for the stdio proxy
 * @returns StdioPassthroughProxy with transport property for advanced use cases
 *
 * @example
 * ```typescript
 * const proxy = await createStdioPassthroughProxy({
 *   target: { url: "http://localhost:3000", transportType: "httpStream" }
 * });
 *
 * // Later, stop the proxy
 * await proxy.stop();
 * ```
 */
export async function createStdioPassthroughProxy(
  config: StdioProxyConfig,
): Promise<ServerPassthroughProxy> {
  const { autoStart = true, ...proxyConfig } = config;

  const fullConfig: Config = {
    ...proxyConfig,
    transportType: "stdio",
  };

  const proxy = new StdioPassthroughProxyImpl(fullConfig);
  await proxy.initialize();

  if (autoStart) {
    await proxy.start();
  }

  return proxy;
}

/**
 * Create an HTTP passthrough proxy
 *
 * @param config Configuration for the HTTP proxy
 * @returns HttpPassthroughProxy for lifecycle management
 *
 * @example
 * ```typescript
 * const proxy = await createHttpPassthroughProxy({
 *   port: 3000,
 *   target: { url: "http://localhost:3001", transportType: "httpStream" }
 * });
 *
 * // Later, stop the proxy
 * await proxy.stop();
 * ```
 */
export async function createHttpPassthroughProxy(
  config: HttpProxyConfig,
): Promise<HttpPassthroughProxy> {
  const { autoStart = true, ...proxyConfig } = config;

  const fullConfig = {
    ...proxyConfig,
    transportType: "httpStream" as const,
  };

  const proxy = new HttpPassthroughProxyImpl(fullConfig);
  await proxy.initialize();

  if (autoStart) {
    await proxy.start();
  }

  return proxy;
}

/**
 * Create an generic Transport passthrough proxy
 *
 * @param config Configuration for the Transport proxy
 * @returns HttpPassthroughProxy for lifecycle management
 *
 * @example
 * ```typescript
 * const proxy = await createHttpPassthroughProxy({
 *   port: 3000,
 *   target: { url: "http://localhost:3001", transportType: "httpStream" }
 * });
 *
 * // Later, stop the proxy
 * await proxy.stop();
 * ```
 */
export async function createTransportPassthroughProxy(
  config: TransportProxyConfig,
): Promise<ServerPassthroughProxy> {
  const { autoStart = true, ...proxyConfig } = config;

  const fullConfig = {
    ...proxyConfig,
    transportType: "custom" as const,
  };

  const proxy = new TransportPassthroughProxyImpl(fullConfig);
  await proxy.initialize();

  if (autoStart) {
    await proxy.start();
  }

  return proxy;
}

/**
 * Create a passthrough proxy with type-specific return based on transport type
 *
 * @param config Configuration including transportType
 * @returns Transport-specific proxy type based on config.transportType
 */
export async function createPassthroughProxy(
  config: StdioProxyConfig & { transportType: "stdio" },
): Promise<ServerPassthroughProxy>;
export async function createPassthroughProxy(
  config: HttpProxyConfig & { transportType: "httpStream" },
): Promise<HttpPassthroughProxy>;
export async function createPassthroughProxy(
  config: TransportProxyConfig & { transportType: "custom" },
): Promise<ServerPassthroughProxy>;
export async function createPassthroughProxy(
  config: Config & { autoStart?: boolean },
): Promise<PassthroughProxy> {
  const { transportType } = config;

  if (transportType === "stdio") {
    return createStdioPassthroughProxy(config);
  }
  if (transportType === "httpStream") {
    return createHttpPassthroughProxy(config);
  }
  if (transportType === "custom") {
    return createTransportPassthroughProxy(config);
  }
  throw new Error(
    `Unsupported transport type: ${transportType}. Only stdio and httpStream are supported.`,
  );
}
