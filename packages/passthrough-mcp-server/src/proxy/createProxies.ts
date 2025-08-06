/**
 * Transport-specific factory functions for creating passthrough proxies
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { configureLoggerForStdio } from "../logger/logger.js";
import type { Config } from "./config.js";
import { HttpPassthroughProxy } from "./http/httpPassthroughProxy.js";
import { StdioPassthroughProxy } from "./stdio/stdioPassthroughProxy.js";
import type { PassthroughProxy } from "./types.js";

export type StdioProxyConfig = Omit<Config, "sourceTransportType" | "port"> & {
  autoStart?: boolean;
};

export type HttpProxyConfig = Omit<Config, "sourceTransportType"> & {
  port: number;
  autoStart?: boolean;
};

export type CustomProxyConfig = Omit<Config, "sourceTransportType"> & {
  transport: Transport;
  autoStart?: boolean;
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
): Promise<StdioPassthroughProxy> {
  // Configure logger for stdio mode to avoid interfering with stdout
  configureLoggerForStdio();
  
  const { autoStart = true, ...proxyConfig } = config;

  const fullConfig: Config = {
    ...proxyConfig,
    sourceTransportType: "stdio",
  };

  const proxy = new StdioPassthroughProxy(fullConfig);
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
    sourceTransportType: "httpStream" as const,
  };

  const proxy = new HttpPassthroughProxy(fullConfig);
  await proxy.initialize();

  if (autoStart) {
    await proxy.start();
  }

  return proxy;
}

/**
 * Create a passthrough proxy with type-specific return based on transport type
 *
 * @param config Configuration including sourceTransportType
 * @returns Transport-specific proxy type based on config.sourceTransportType
 */
export async function createPassthroughProxy(
  config: StdioProxyConfig & { sourceTransportType: "stdio" },
): Promise<StdioPassthroughProxy>;
export async function createPassthroughProxy(
  config: HttpProxyConfig & { sourceTransportType: "httpStream" },
): Promise<HttpPassthroughProxy>;
export async function createPassthroughProxy(
  config: Config & { autoStart?: boolean },
): Promise<PassthroughProxy> {
  const { sourceTransportType } = config;

  if (sourceTransportType === "stdio") {
    return createStdioPassthroughProxy(config);
  }
  if (sourceTransportType === "httpStream") {
    return createHttpPassthroughProxy(config);
  }
  if (sourceTransportType === "custom") {
    throw new Error("Custom Transport not supported yet.");
  }
  throw new Error(
    `Unsupported transport type: ${sourceTransportType}. Only stdio and httpStream are supported.`,
  );
}
