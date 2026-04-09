import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { RequestExtra } from "@civic/hook-common";
import { ServerHook } from "@civic/server-hook";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PassthroughContext } from "../shared/passthroughContext.js";

/**
 * Integration tests for PassthroughContext.reconnectServer().
 *
 * These tests verify that swapping the server-side transport:
 *  - never throws "Already connected to a transport"
 *  - preserves the client connection
 *  - preserves all registered hooks (and their state)
 *  - preserves the context-level onclose / onerror callbacks
 *  - does NOT cascade-close the client when the old transport is closed
 */
describe("PassthroughContext.reconnectServer", () => {
  const TEST_TIMEOUT = 10_000;

  // ── helpers ──────────────────────────────────────────────────────────

  function createServerTransport() {
    return new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
  }

  function createClientTransport(url: URL) {
    return new StreamableHTTPClientTransport(url);
  }

  async function startHttpServer(
    transport: StreamableHTTPServerTransport,
  ): Promise<{ server: Server; url: URL }> {
    const server = createServer();
    server.on("request", async (req, res) => {
      await transport.handleRequest(req, res);
    });
    const url = await new Promise<URL>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}`));
      });
    });
    return { server, url };
  }

  function createToolsHook() {
    return {
      get name() {
        return "ToolsHook";
      },
      async processListToolsRequest(
        _request: unknown,
        _requestExtra: RequestExtra,
      ) {
        return {
          resultType: "respond" as const,
          response: {
            tools: [
              {
                name: "ping",
                description: "Returns pong",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          },
        };
      },
      async processCallToolRequest(
        request: { params: { name: string; arguments?: Record<string, unknown> } },
        _requestExtra: RequestExtra,
      ) {
        if (request.params.name === "ping") {
          return {
            resultType: "respond" as const,
            response: {
              content: [{ type: "text" as const, text: "pong" }],
            },
          };
        }
        return { resultType: "continue" as const, request };
      },
      async processCallToolResult(
        response: unknown,
        _originalRequest: unknown,
        _requestExtra: RequestExtra,
      ) {
        return { resultType: "continue" as const, response };
      },
    };
  }

  function createCountingHook() {
    let count = 0;
    return {
      get name() {
        return "CountingHook";
      },
      get count() {
        return count;
      },
      async processCallToolRequest(
        request: unknown,
        _requestExtra: RequestExtra,
      ) {
        count++;
        return { resultType: "continue" as const, request };
      },
      async processCallToolResult(
        response: unknown,
        _originalRequest: unknown,
        _requestExtra: RequestExtra,
      ) {
        return { resultType: "continue" as const, response };
      },
    };
  }

  // ── teardown bookkeeping ─────────────────────────────────────────────

  const teardowns: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    for (const fn of teardowns.reverse()) {
      try {
        await fn();
      } catch { /* best-effort */ }
    }
    teardowns.length = 0;
  });

  function onTeardown(fn: () => Promise<void> | void) {
    teardowns.push(fn);
  }

  async function setupFullStack(hooks: unknown[] = []) {
    const serverHook = new ServerHook({
      serverInfo: { name: "reconnect-test-server", version: "1.0.0" },
      options: { capabilities: { tools: {} } },
    });
    const allHooks = [serverHook, ...hooks];

    const context = new PassthroughContext(allHooks);
    const serverTransport = createServerTransport();
    await context.connect(serverTransport);

    const { server, url } = await startHttpServer(serverTransport);

    const client = new Client({ name: "reconnect-test-client", version: "1.0.0" });
    const clientTransport = createClientTransport(url);
    await client.connect(clientTransport);

    onTeardown(() => clientTransport.close().catch(() => {}));
    onTeardown(() => context.close().catch(() => {}));
    onTeardown(() => server.close());

    return { context, serverTransport, server, url, client, clientTransport, serverHook };
  }

  /** Reconnect the server side and return a new client connected through the new transport. */
  async function reconnectAndCreateClient(
    context: PassthroughContext,
    clientName: string,
  ) {
    const newServerTransport = createServerTransport();
    const { server, url } = await startHttpServer(newServerTransport);
    onTeardown(() => server.close());

    await context.reconnectServer(newServerTransport);

    const newClient = new Client({ name: clientName, version: "1.0.0" });
    const newClientTransport = createClientTransport(url);
    onTeardown(() => newClientTransport.close().catch(() => {}));
    await newClient.connect(newClientTransport);

    return { newClient, newClientTransport, server };
  }

  // ── tests ────────────────────────────────────────────────────────────

  it(
    "should replace the server transport without throwing 'Already connected'",
    async () => {
      const toolsHook = createToolsHook();
      const { context, client } = await setupFullStack([toolsHook]);

      // Verify the initial connection works
      const result1 = await client.request(
        { method: "tools/list", params: {} },
        ListToolsResultSchema,
      );
      expect(result1.tools).toHaveLength(1);

      // Reconnect — this MUST NOT throw "Already connected to a transport"
      const { newClient } = await reconnectAndCreateClient(context, "reconnect-client-2");

      const result2 = await newClient.request(
        { method: "tools/list", params: {} },
        ListToolsResultSchema,
      );
      expect(result2.tools).toHaveLength(1);
      expect(result2.tools[0].name).toBe("ping");
    },
    TEST_TIMEOUT,
  );

  it(
    "should preserve hooks and their accumulated state across reconnect",
    async () => {
      const toolsHook = createToolsHook();
      const countingHook = createCountingHook();
      const { context, client } = await setupFullStack([countingHook, toolsHook]);

      // Two tool calls on the original transport
      await client.request(
        { method: "tools/call", params: { name: "ping", arguments: {} } },
        z.any(),
      );
      await client.request(
        { method: "tools/call", params: { name: "ping", arguments: {} } },
        z.any(),
      );
      expect(countingHook.count).toBe(2);

      // Reconnect and make another call
      const { newClient } = await reconnectAndCreateClient(context, "state-client");

      await newClient.request(
        { method: "tools/call", params: { name: "ping", arguments: {} } },
        z.any(),
      );

      // Hook state is preserved — count continues from 2
      expect(countingHook.count).toBe(3);
    },
    TEST_TIMEOUT,
  );

  it(
    "should NOT cascade-close the client endpoint during reconnect",
    async () => {
      const toolsHook = createToolsHook();
      const { context } = await setupFullStack([toolsHook]);

      // Track whether the client-side transport fires its onclose
      let clientEndpointClosed = false;
      const clientTransportObj = context.target.transport();
      if (clientTransportObj) {
        const prev = clientTransportObj.onclose;
        clientTransportObj.onclose = () => {
          clientEndpointClosed = true;
          prev?.();
        };
      }

      // Reconnect — old server transport is closed, but must NOT cascade
      await reconnectAndCreateClient(context, "cascade-client");

      // Allow any async cascade to propagate
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(clientEndpointClosed).toBe(false);
    },
    TEST_TIMEOUT,
  );

  it(
    "should NOT invoke context.onclose during reconnect",
    async () => {
      const toolsHook = createToolsHook();
      const { context } = await setupFullStack([toolsHook]);

      const onCloseSpy = vi.fn();
      context.onclose = onCloseSpy;

      await reconnectAndCreateClient(context, "onclose-client");

      // Wait a bit to catch any deferred callbacks
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onCloseSpy).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT,
  );

  it(
    "should preserve context-level onclose and onerror callbacks",
    async () => {
      const toolsHook = createToolsHook();
      const { context } = await setupFullStack([toolsHook]);

      const onCloseSpy = vi.fn();
      const onErrorSpy = vi.fn();
      context.onclose = onCloseSpy;
      context.onerror = onErrorSpy;

      await reconnectAndCreateClient(context, "callbacks-client");

      // Callbacks must still be the same references
      expect(context.onclose).toBe(onCloseSpy);
      expect(context.onerror).toBe(onErrorSpy);

      // onclose must NOT have been called during reconnect
      expect(onCloseSpy).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT,
  );

  it(
    "should support multiple consecutive reconnects",
    async () => {
      const toolsHook = createToolsHook();
      const countingHook = createCountingHook();
      const { context, server } = await setupFullStack([countingHook, toolsHook]);
      server.close();

      for (let i = 0; i < 3; i++) {
        const transport = createServerTransport();
        const { server: srv, url } = await startHttpServer(transport);

        await context.reconnectServer(transport);

        const c = new Client({ name: `multi-${i}`, version: "1.0.0" });
        const ct = createClientTransport(url);
        await c.connect(ct);

        await c.request(
          { method: "tools/call", params: { name: "ping", arguments: {} } },
          z.any(),
        );

        await ct.close();
        srv.close();
      }

      // All 3 calls went through the same counting hook
      expect(countingHook.count).toBe(3);
    },
    TEST_TIMEOUT,
  );

  it(
    "should restore the cascade handler so that a normal close still works",
    async () => {
      const toolsHook = createToolsHook();
      const { context, server } = await setupFullStack([toolsHook]);

      // Reconnect once
      await reconnectAndCreateClient(context, "cascade-restore-client");
      server.close();

      // A full context.close() should still work cleanly
      await expect(context.close()).resolves.not.toThrow();
    },
    TEST_TIMEOUT,
  );

  it(
    "should work when no client transport was connected",
    async () => {
      const serverHook = new ServerHook({
        serverInfo: { name: "no-client-server", version: "1.0.0" },
        options: { capabilities: { tools: {} } },
      });
      const toolsHook = createToolsHook();
      const context = new PassthroughContext([serverHook, toolsHook]);

      const serverTransport = createServerTransport();
      await context.connect(serverTransport);
      const { server } = await startHttpServer(serverTransport);
      onTeardown(() => context.close().catch(() => {}));
      onTeardown(() => server.close());

      // Reconnect without a client — should not throw
      const newServerTransport = createServerTransport();
      const { server: newServer, url: newUrl } = await startHttpServer(newServerTransport);
      onTeardown(() => newServer.close());

      await expect(context.reconnectServer(newServerTransport)).resolves.not.toThrow();
      server.close();

      // Verify the new transport works
      const client = new Client({ name: "no-client-test", version: "1.0.0" });
      const clientTransport = createClientTransport(newUrl);
      onTeardown(() => clientTransport.close().catch(() => {}));
      await client.connect(clientTransport);

      const result = await client.request(
        { method: "tools/list", params: {} },
        ListToolsResultSchema,
      );
      expect(result.tools).toHaveLength(1);
    },
    TEST_TIMEOUT,
  );
});
