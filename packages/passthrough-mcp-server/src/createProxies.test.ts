/**
 * Type tests for createPassthroughProxy overloads
 * This file verifies that TypeScript correctly infers return types
 */

import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createPassthroughProxy } from "./createProxies.js";
import type { HttpPassthroughProxy, ServerPassthroughProxy } from "./types.js";

describe("createPassthroughProxy type inference", () => {
  it("should return StdioPassthroughProxy when transportType is 'stdio'", async () => {
    const proxy = await createPassthroughProxy({
      transportType: "stdio",
      target: { url: "http://localhost:33355", transportType: "httpStream" },
    });

    // TypeScript should know this is StdioPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<ServerPassthroughProxy>();
    expect(proxy.server).toBeDefined();
    expectTypeOf(proxy.server.transport).toEqualTypeOf<StdioServerTransport>();
  });

  it("should return HttpPassthroughProxy when transportType is 'httpStream'", async () => {
    const proxy = await createPassthroughProxy({
      transportType: "httpStream",
      port: 33355,
      target: { url: "http://localhost:3001", transportType: "httpStream" },
    });

    // TypeScript should know this is HttpPassthroughProxy
    expectTypeOf(proxy).toEqualTypeOf<HttpPassthroughProxy>();
    // HttpPassthroughProxy doesn't expose transport
    expect("transport" in proxy).toBe(false);
  });
});
