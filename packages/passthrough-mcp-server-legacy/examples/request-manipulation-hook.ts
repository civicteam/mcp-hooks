/**
 * Example: Request Manipulation Hook
 *
 * This example demonstrates how to use the req field to manipulate
 * headers, host, and path in HTTP requests.
 */

import {
  AbstractHook,
  type CallToolRequestWithContext,
  type CallToolResult,
  type InitializeRequestHookResult,
  type InitializeRequestWithContext,
  type InitializeResponseHookResult,
  type InitializeResult,
  type ListToolsRequestHookResult,
  type ListToolsRequestWithContext,
  type ListToolsResponseHookResult,
  type ListToolsResult,
  type ToolCallRequestHookResult,
  type ToolCallResponseHookResult,
} from "@civic/hook-common";

/**
 * Example 1: Authentication Header Hook
 * Adds authentication headers to all requests
 */
export class AuthenticationHeaderHook extends AbstractHook {
  get name() {
    return "auth-header-hook";
  }

  private readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    // Add authentication header
    const modifiedHeaders = {
      ...request.req?.headers,
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Version": "2.0",
    };

    return {
      resultType: "continue",
      request,
      req: {
        ...request.req,
        headers: modifiedHeaders,
      },
    };
  }

  async processToolsListRequest(
    request: ListToolsRequestWithContext,
  ): Promise<ListToolsRequestHookResult> {
    // Add authentication header for list requests too
    const modifiedHeaders = {
      ...request.req?.headers,
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Version": "2.0",
    };

    return {
      resultType: "continue",
      request,
      req: {
        ...request.req,
        headers: modifiedHeaders,
      },
    };
  }
}

/**
 * Example 2: Conditional Routing Hook
 * Routes requests to different hosts based on tool name
 */
export class ConditionalRoutingHook extends AbstractHook {
  get name() {
    return "conditional-routing-hook";
  }

  private readonly routingRules: Record<string, string>;

  constructor(routingRules: Record<string, string>) {
    super();
    this.routingRules = routingRules;
  }

  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    const toolName = request.params.name;
    const targetHost = this.routingRules[toolName];

    if (targetHost) {
      console.log(`Routing tool ${toolName} to ${targetHost}`);
      return {
        resultType: "continue",
        request,
        req: {
          ...request.req,
          host: targetHost,
        },
      };
    }

    // No routing rule found, continue with default
    return { resultType: "continue", request };
  }
}

/**
 * Example 3: Path Rewriting Hook
 * Rewrites paths based on patterns
 */
export class PathRewritingHook extends AbstractHook {
  get name() {
    return "path-rewriting-hook";
  }

  private readonly pathMappings: Array<{ from: RegExp; to: string }>;

  constructor(pathMappings: Array<{ from: RegExp; to: string }>) {
    super();
    this.pathMappings = pathMappings;
  }

  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    if (!request.req?.path) {
      return { resultType: "continue", request };
    }

    let modifiedPath = request.req.path;

    // Apply path rewriting rules
    for (const mapping of this.pathMappings) {
      if (mapping.from.test(modifiedPath)) {
        modifiedPath = modifiedPath.replace(mapping.from, mapping.to);
        console.log(
          `Rewriting path from ${request.req.path} to ${modifiedPath}`,
        );
        break;
      }
    }

    return {
      resultType: "continue",
      request,
      req: {
        ...request.req,
        path: modifiedPath,
      },
    };
  }
}

/**
 * Example 4: Header Filtering Hook
 * Removes sensitive headers before forwarding
 */
export class HeaderFilteringHook extends AbstractHook {
  get name() {
    return "header-filtering-hook";
  }

  private readonly sensitiveHeaders: string[];

  constructor(sensitiveHeaders: string[]) {
    super();
    this.sensitiveHeaders = sensitiveHeaders;
  }

  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    if (!request.req?.headers) {
      return { resultType: "continue", request };
    }

    // Filter out sensitive headers
    const filteredHeaders = Object.entries(request.req.headers).reduce(
      (acc, [key, value]) => {
        if (!this.sensitiveHeaders.includes(key.toLowerCase())) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      resultType: "continue",
      request,
      req: {
        ...request.req,
        headers: filteredHeaders,
      },
    };
  }
}

/**
 * Example 5: Combined Hook
 * Demonstrates using all req fields together
 */
export class CombinedManipulationHook extends AbstractHook {
  get name() {
    return "combined-manipulation-hook";
  }

  async processToolCallRequest(
    request: CallToolRequestWithContext,
  ): Promise<ToolCallRequestHookResult> {
    const toolName = request.params.name;

    // Different manipulations based on tool
    if (toolName === "search") {
      // Route search requests to a dedicated search service
      return {
        resultType: "continue",
        request,
        req: {
          headers: {
            ...request.req?.headers,
            "X-Service": "search",
            "X-Priority": "high",
          },
          host: "search-service.internal",
          path: "/api/v2/search",
        },
      };
    }
    if (toolName === "analytics") {
      // Route analytics to a different region
      return {
        resultType: "continue",
        request,
        req: {
          headers: {
            ...request.req?.headers,
            "X-Region": "us-west-2",
          },
          host: "analytics-us-west-2.internal",
          path: request.req?.path, // Keep original path
        },
      };
    }

    // Default: just add a tracking header
    return {
      resultType: "continue",
      request,
      req: {
        ...request.req,
        headers: {
          ...request.req?.headers,
          "X-Request-ID": `req-${Date.now()}`,
        },
      },
    };
  }
}

// Example usage
async function main() {
  console.log("Request Manipulation Hook Examples");
  console.log("=================================");

  // Example 1: Authentication
  const authHook = new AuthenticationHeaderHook("sk-test-12345");
  const authRequest: CallToolRequestWithContext = {
    method: "tools/call",
    params: {
      name: "search",
      arguments: { query: "test" },
    },
    req: {
      headers: { "Content-Type": "application/json" },
      host: "api.example.com",
      path: "/mcp",
    },
  };

  const authResult = await authHook.processToolCallRequest(authRequest);
  console.log("\nAuth Hook Result:", JSON.stringify(authResult, null, 2));

  // Example 2: Conditional Routing
  const routingHook = new ConditionalRoutingHook({
    search: "search-service.internal",
    calculate: "compute-service.internal",
    storage: "storage-service.internal",
  });

  const routingRequest: CallToolRequestWithContext = {
    method: "tools/call",
    params: {
      name: "search",
      arguments: { query: "test" },
    },
    req: {
      headers: {},
      host: "default.internal",
      path: "/mcp",
    },
  };

  const routingResult =
    await routingHook.processToolCallRequest(routingRequest);
  console.log("\nRouting Hook Result:", JSON.stringify(routingResult, null, 2));

  // Example 3: Path Rewriting
  const pathHook = new PathRewritingHook([
    { from: /^\/mcp$/, to: "/api/v2/mcp" },
    { from: /^\/v1\/(.*)/, to: "/v2/$1" },
  ]);

  const pathRequest: CallToolRequestWithContext = {
    method: "tools/call",
    params: {
      name: "test",
      arguments: {},
    },
    req: {
      headers: {},
      host: "api.example.com",
      path: "/mcp",
    },
  };

  const pathResult = await pathHook.processToolCallRequest(pathRequest);
  console.log("\nPath Hook Result:", JSON.stringify(pathResult, null, 2));

  // Example 4: Header Filtering
  const filterHook = new HeaderFilteringHook([
    "x-internal-secret",
    "x-debug-token",
    "cookie",
  ]);

  const filterRequest: CallToolRequestWithContext = {
    method: "tools/call",
    params: {
      name: "test",
      arguments: {},
    },
    req: {
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": "should-be-removed",
        "X-Debug-Token": "also-removed",
        "X-Public-Header": "kept",
      },
      host: "api.example.com",
      path: "/mcp",
    },
  };

  const filterResult = await filterHook.processToolCallRequest(filterRequest);
  console.log("\nFilter Hook Result:", JSON.stringify(filterResult, null, 2));
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
