/**
 * Transport Factory Module
 *
 * Provides helper functions for creating client transports based on configuration.
 * This ensures consistent transport creation across different proxy implementations.
 */

import { URL } from "node:url";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { RequestContextAwareStreamableHTTPClientTransport } from "../transports/requestContextAwareStreamableHTTPClientTransport.js";
import type { TargetConfig } from "./config.js";

/**
 * Creates a client transport based on the target configuration
 * @param targetConfig - Target server configuration
 * @param authToken - Optional auth token for HTTP requests
 * @param customHeaders - Optional custom headers to include
 * @returns Configured transport instance
 */
export function createClientTransport(
  targetConfig: TargetConfig,
  authToken?: string,
  customHeaders?: Record<string, string>,
): Transport {
  if (targetConfig.transportType === "custom") {
    if (!targetConfig.transportFactory) {
      throw new Error("Custom transport factory is not defined");
    }
    return targetConfig.transportFactory();
  }

  if (targetConfig.transportType === "httpStream") {
    const targetMcpPath = targetConfig.mcpPath || "/mcp";
    const url = new URL(targetConfig.url + targetMcpPath);

    // Build headers from authToken and customHeaders
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    const options = {
      requestInit: {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      },
    };

    return new RequestContextAwareStreamableHTTPClientTransport(url, options);
  }

  throw new Error(
    `Unsupported Client Transport Type: ${targetConfig.transportType}. Supported types: httpStream, custom.`,
  );
}
