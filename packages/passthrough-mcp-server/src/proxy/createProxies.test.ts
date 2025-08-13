/**
 * Type tests for createPassthroughProxy overloads
 * This file verifies that TypeScript correctly infers return types
 */

import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createPassthroughProxy } from "./createProxies.js";
import type { HttpPassthroughProxy } from "./http/httpPassthroughProxy";
import type { StdioPassthroughProxy } from "./stdio/stdioPassthroughProxy";

describe("createPassthroughProxy type inference", () => {
  it("should return StdioPassthroughProxy when sourceTransportType is 'stdio'", async () => {
    const proxy = await createPassthroughProxy({
      sourceTransportType: "stdio",
      target: { url: "http://localhost:33355", transportType: "httpStream" },
    });

    // TypeScript should know this is StdioPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<StdioPassthroughProxy>();
  });

  it("should return HttpPassthroughProxy when sourceTransportType is 'httpStream'", async () => {
    const proxy = await createPassthroughProxy({
      sourceTransportType: "httpStream",
      port: 33355,
      sourceMcpPath: "/mcp", // Path to MCP endpoint of the http server, defaults to /mcp
      transportFactory: (options: StreamableHTTPServerTransportOptions) =>
        new StreamableHTTPServerTransport(options),
      target: { url: "http://localhost:3001", transportType: "httpStream" },
    });

    // TypeScript should know this is HttpPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<HttpPassthroughProxy>();
  });
});
