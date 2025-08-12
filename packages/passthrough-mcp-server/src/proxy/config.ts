/**
 * Configuration Management Module
 *
 * Handles loading and defining the configuration for both the MCP server
 * and the target client connection. Loads settings from environment variables
 * and command line arguments.
 */

import * as process from "node:process";
import type { Hook } from "@civic/hook-common";
import type {
  StreamableHTTPServerTransport,
  StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { logger } from "../logger/logger.js";

type SourceTransportType = "stdio" | "httpStream";

// Base configuration with discriminated union based on transport type
export type BaseConfig =
  | {
      sourceTransportType: "stdio";
      // Port is not required for stdio
    }
  | {
      sourceTransportType: "httpStream";
      port: number;
      sourceMcpPath?: string; // Path to MCP endpoint of the http server, defaults to /mcp
      transportFactory?: (
        options: StreamableHTTPServerTransportOptions,
      ) => StreamableHTTPServerTransport;
    };

export type TargetConfig =
  | {
      transportType: "httpStream" | "sse";
      url: string;
      mcpPath?: string; // Path to MCP endpoint on target server, defaults to /mcp
    }
  | {
      transportType: "custom";
      transportFactory: () => Transport;
    };

export interface RemoteHookConfig {
  url: string;
  name?: string; // Optional name for the hook
}

export type HookDefinition = RemoteHookConfig | Hook;

export type Config = BaseConfig & {
  target: TargetConfig;
  hooks?: HookDefinition[];
  authToken?: string; // Optional auth token for stdio transport
};

/**
 * Parse server transport type from command line arguments
 */
export function parseServerTransport(args: string[]): SourceTransportType {
  if (args.includes("--stdio")) return "stdio";
  return "httpStream";
}

/**
 * Parse client transport type from environment
 */
export function parseClientTransport(
  env: NodeJS.ProcessEnv,
): "sse" | "httpStream" {
  return env.TARGET_SERVER_TRANSPORT === "sse" ? "sse" : "httpStream";
}

/**
 * Parse hook URLs from environment variable
 */
export function parseHookUrls(hooksEnv?: string): string[] {
  if (!hooksEnv) return [];
  return hooksEnv
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

/**
 * Convert hook URLs to hook configurations
 */
export function createHookConfigs(urls: string[]): RemoteHookConfig[] {
  return urls.map((url) => {
    try {
      const urlObj = new URL(url);
      return {
        url,
        name: urlObj.hostname,
      };
    } catch {
      // If URL parsing fails, use the whole URL as name
      return {
        url,
        name: url,
      };
    }
  });
}

/**
 * Load configuration from environment and command line
 */
export function loadConfig(): Config {
  // Server configuration
  const sourceTransportType = parseServerTransport(process.argv);
  const sourceMcpPath =
    process.env.SOURCE_SERVER_MCP_PATH || process.env.TARGET_SERVER_MCP_PATH;

  // Target configuration
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33000";
  const targetTransport = parseClientTransport(process.env);
  const targetMcpPath = process.env.TARGET_SERVER_MCP_PATH; // Optional, defaults to /mcp

  // Hooks configuration
  const hookUrls = parseHookUrls(process.env.HOOKS);

  // Build config based on transport type
  let config: Config;

  if (sourceTransportType === "stdio") {
    config = {
      sourceTransportType: "stdio",
      target: {
        url: targetUrl,
        transportType: targetTransport,
        ...(targetMcpPath && { mcpPath: targetMcpPath }),
      },
    };
  } else if (sourceTransportType === "httpStream") {
    const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 34000;
    config = {
      sourceTransportType,
      sourceMcpPath,
      port,
      target: {
        url: targetUrl,
        transportType: targetTransport,
        ...(targetMcpPath && { mcpPath: targetMcpPath }),
      },
    };
  } else {
    throw new Error(
      `Source Transport Type ${sourceTransportType} not supported`,
    );
  }

  // Add hooks config if URLs are provided
  if (hookUrls.length > 0) {
    config.hooks = createHookConfigs(hookUrls);

    logger.info(`${hookUrls.length} tRPC hooks enabled:`);
    hookUrls.forEach((url, index) => {
      logger.info(`  ${index + 1}. ${url}`);
    });
  }

  return config;
}
