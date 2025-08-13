/**
 * Transport-specific factory functions for creating passthrough proxies
 */

import { configureLoggerForStdio } from "../logger/logger.js";
import type { Config } from "./config.js";
import {
  HttpPassthroughProxy,
  type HttpProxyConfig,
} from "./http/httpPassthroughProxy.js";
import {
  StdioPassthroughProxy,
  type StdioProxyConfig,
} from "./stdio/stdioPassthroughProxy.js";
import type { PassthroughProxy } from "./types.js";

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

  const proxy = new StdioPassthroughProxy(config);
  await proxy.initialize();

  const { autoStart = true } = config;

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
  const proxy = new HttpPassthroughProxy(config);
  await proxy.initialize();

  const { autoStart = true } = config;

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
  config: Config & { autoStart?: boolean },
): Promise<PassthroughProxy> {
  const { source, autoStart, ...otherConfig } = config;
  const { transportType, ...otherSource } = source;

  if (transportType === "stdio") {
    return createStdioPassthroughProxy({
      ...otherConfig,
      ...otherSource,
      autoStart,
    });
  }
  if (transportType === "httpStream") {
    return createHttpPassthroughProxy({
      ...otherConfig,
      ...otherSource,
      autoStart,
    });
  }
  throw new Error(
    `Unsupported transport type: ${transportType}. Only stdio and httpStream are supported.`,
  );
}
