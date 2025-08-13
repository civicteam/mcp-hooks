/**
 * Type tests for createPassthroughProxy overloads
 * This file verifies that TypeScript correctly infers return types
 */

import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createHttpPassthroughProxy,
  createPassthroughProxy,
  createStdioPassthroughProxy,
} from "./createProxies.js";
import type { HttpPassthroughProxy } from "./http/httpPassthroughProxy";
import type { StdioPassthroughProxy } from "./stdio/stdioPassthroughProxy";
import type { PassthroughProxy } from "./types";

describe("createPassthroughProxy type inference", () => {
  it("should work with stdio source transport", async () => {
    const proxy = await createPassthroughProxy({
      source: { transportType: "stdio" },
      target: { url: "http://localhost:33355", transportType: "httpStream" },
    });

    // TypeScript should know this is StdioPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<StdioPassthroughProxy>();
  });

  it("should work with httpStream source transport", async () => {
    const proxy = await createPassthroughProxy({
      source: {
        transportType: "httpStream",
        port: 33355,
        mcpPath: "/mcp", // Path to MCP endpoint of the http server, defaults to /mcp
        transportFactory: (options: StreamableHTTPServerTransportOptions) =>
          new StreamableHTTPServerTransport(options),
      },
      target: { url: "http://localhost:3001", transportType: "httpStream" },
    });

    // TypeScript should know this is HttpPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<HttpPassthroughProxy>();
  });
});

describe("createStdioPassthroughProxy", () => {
  it("should create a StdioPassthroughProxy directly", async () => {
    const proxy = await createStdioPassthroughProxy({
      target: { url: "http://localhost:33355", transportType: "httpStream" },
      autoStart: false, // Don't auto-start for test
    });

    expectTypeOf(proxy).toEqualTypeOf<StdioPassthroughProxy>();
    expect(proxy).toBeDefined();
    await proxy.stop();
  });

  it("should support hooks configuration", async () => {
    const proxy = await createStdioPassthroughProxy({
      target: { url: "http://localhost:33355", transportType: "httpStream" },
      hooks: [{ url: "http://localhost:8080/hook", name: "test-hook" }],
      authToken: "test-token",
      autoStart: false,
    });

    expectTypeOf(proxy).toEqualTypeOf<StdioPassthroughProxy>();
    expect(proxy).toBeDefined();
    await proxy.stop();
  });
});

describe("createHttpPassthroughProxy", () => {
  it("should create an HttpPassthroughProxy directly", async () => {
    const proxy = await createHttpPassthroughProxy({
      port: 33356,
      target: { url: "http://localhost:33355", transportType: "httpStream" },
      autoStart: false, // Don't auto-start for test
    });

    expectTypeOf(proxy).toEqualTypeOf<HttpPassthroughProxy>();
    expect(proxy).toBeDefined();
    await proxy.stop();
  });

  it("should support HTTP-specific configuration", async () => {
    const proxy = await createHttpPassthroughProxy({
      port: 33357,
      mcpPath: "/custom-mcp",
      transportFactory: (options: StreamableHTTPServerTransportOptions) =>
        new StreamableHTTPServerTransport(options),
      target: { url: "http://localhost:33355", transportType: "httpStream" },
      hooks: [{ url: "http://localhost:8080/hook", name: "test-hook" }],
      authToken: "test-token",
      autoStart: false,
    });

    expectTypeOf(proxy).toEqualTypeOf<HttpPassthroughProxy>();
    expect(proxy).toBeDefined();
    await proxy.stop();
  });
});
