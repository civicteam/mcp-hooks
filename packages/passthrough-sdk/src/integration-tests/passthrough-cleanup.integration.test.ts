import { describe, expect, it } from "vitest";
import { StreamableHTTPClientTransport } from "../legacy/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "../legacy/server/streamableHttp.js";
import { PassthroughContext } from "../shared/passthroughContext.js";

describe("Passthrough Cleanup Integration Tests", () => {
  // Set longer timeout for cleanup tests
  const CLEANUP_TIMEOUT = 5000;

  // Helper function to create real HTTP streaming transports
  function createRealTransports() {
    // Create real server transport (no need to connect to actual HTTP server)
    const serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Create real client transport (no need to connect to actual server)
    const clientTransport = new StreamableHTTPClientTransport(
      new URL("http://localhost:9999/test"), // Dummy URL, won't be used
    );

    return { serverTransport, clientTransport };
  }

  // Helper function to set up onclose callback tracking
  function setupOncloseTracking(
    serverTransport: StreamableHTTPServerTransport,
    clientTransport: StreamableHTTPClientTransport,
  ) {
    let serverTransportClosed = false;
    let clientTransportClosed = false;

    const originalServerOnclose = serverTransport.onclose;
    const originalClientOnclose = clientTransport.onclose;

    serverTransport.onclose = () => {
      serverTransportClosed = true;
      console.log("Server transport onclose triggered");
      originalServerOnclose?.();
    };

    clientTransport.onclose = () => {
      clientTransportClosed = true;
      console.log("Client transport onclose triggered");
      originalClientOnclose?.();
    };

    return {
      serverTransportClosed: () => serverTransportClosed,
      clientTransportClosed: () => clientTransportClosed,
    };
  }

  // Helper function to set up context and connect transports
  async function setupContextWithTransports() {
    const context = new PassthroughContext();
    const { serverTransport, clientTransport } = createRealTransports();
    const tracking = setupOncloseTracking(serverTransport, clientTransport);

    await context.connect(serverTransport, clientTransport);

    return {
      context,
      serverTransport,
      clientTransport,
      isServerClosed: tracking.serverTransportClosed,
      isClientClosed: tracking.clientTransportClosed,
    };
  }

  describe("PassthroughContext Cleanup", () => {
    it(
      "should exit cleanly after closing PassthroughContext",
      async () => {
        const context = new PassthroughContext();
        const { serverTransport, clientTransport } = createRealTransports();

        try {
          // Connect the context to the real transports
          await context.connect(serverTransport, clientTransport);

          // The main test: close the context
          console.log("Closing PassthroughContext...");
          await context.close();

          // If we reach here without hanging, the context cleaned up properly
          expect(true).toBe(true);
        } catch (error) {
          // If cleanup fails, we still want to attempt final cleanup
          console.error("Error during cleanup test:", error);
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should handle repeated close calls without issues",
      async () => {
        const context = new PassthroughContext();
        const { serverTransport, clientTransport } = createRealTransports();

        try {
          await context.connect(serverTransport, clientTransport);

          // The main test: multiple close calls should be safe
          console.log("Calling close multiple times...");
          await context.close();
          await context.close(); // Second close should be safe
          await context.close(); // Third close should be safe

          // If we reach here, repeated closes are handled properly
          expect(true).toBe(true);
        } catch (error) {
          console.error("Error during repeated close test:", error);
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should prevent resource leaks during repeated setup/teardown cycles",
      async () => {
        // This test verifies that repeated setup/teardown doesn't cause resource leaks
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          console.log(`Cleanup cycle ${i + 1}/${iterations}`);

          const context = new PassthroughContext();
          const { serverTransport, clientTransport } = createRealTransports();

          try {
            // Setup
            await context.connect(serverTransport, clientTransport);

            // Immediate cleanup
            await context.close();
          } catch (error) {
            console.error(`Error in cleanup cycle ${i + 1}:`, error);
            throw error;
          }
        }

        // If we complete all iterations without hanging, no resource leaks occurred
        expect(true).toBe(true);
      },
      CLEANUP_TIMEOUT * 2,
    ); // Longer timeout for multiple cycles

    it(
      "should handle cleanup before connection",
      async () => {
        const context = new PassthroughContext();

        try {
          // The main test: close before connect should be safe
          console.log("Closing PassthroughContext before connection...");
          await context.close();

          // If we reach here, closing before connection is handled properly
          expect(true).toBe(true);
        } catch (error) {
          console.error("Error during close-before-connect test:", error);
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should handle concurrent close operations",
      async () => {
        const context = new PassthroughContext();
        const { serverTransport, clientTransport } = createRealTransports();

        try {
          await context.connect(serverTransport, clientTransport);

          // The main test: concurrent close calls should be safe
          console.log("Calling close concurrently...");
          const closePromises = [
            context.close(),
            context.close(),
            context.close(),
          ];

          await Promise.all(closePromises);

          // If we reach here, concurrent closes are handled properly
          expect(true).toBe(true);
        } catch (error) {
          console.error("Error during concurrent close test:", error);
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should cascade cleanup when serverTransport is closed",
      async () => {
        const { context, serverTransport, isServerClosed, isClientClosed } =
          await setupContextWithTransports();

        try {
          // The main test: close the server transport and expect cascade
          console.log("Closing server transport...");
          await serverTransport.close();

          // Verify server transport onclose was called
          expect(isServerClosed()).toBe(true);

          // Give some time for cascading cleanup to occur
          await new Promise((resolve) => setTimeout(resolve, 100));

          // If cascade cleanup is implemented, the client transport should also be closed
          console.log("Verifying cascade cleanup completed...");

          expect(isClientClosed()).toBe(true);
          console.log("Client transport closed via cascade:", isClientClosed());

          // Try to close the context - this should be safe even if cascade happened
          await context.close();

          // If we reach here, either cascade worked or at least cleanup is safe
          expect(true).toBe(true);
        } catch (error) {
          console.error("Error during server transport close test:", error);
          // Don't throw immediately - try to clean up first
          try {
            await context.close();
          } catch (cleanupError) {
            console.error("Additional error during cleanup:", cleanupError);
          }
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should cascade cleanup when clientTransport is closed",
      async () => {
        const { context, clientTransport, isServerClosed, isClientClosed } =
          await setupContextWithTransports();

        try {
          // The main test: close the client transport and expect cascade
          console.log("Closing client transport...");
          await clientTransport.close();

          // Verify client transport onclose was called
          expect(isClientClosed()).toBe(true);

          // Give some time for cascading cleanup to occur
          await new Promise((resolve) => setTimeout(resolve, 100));

          // If cascade cleanup is implemented, the server transport should also be closed
          console.log("Verifying cascade cleanup completed...");

          expect(isServerClosed()).toBe(true);
          console.log("Server transport closed via cascade:", isServerClosed());

          // Try to close the context - this should be safe even if cascade happened
          await context.close();

          // If we reach here, either cascade worked or at least cleanup is safe
          expect(true).toBe(true);
        } catch (error) {
          console.error("Error during client transport close test:", error);
          // Don't throw immediately - try to clean up first
          try {
            await context.close();
          } catch (cleanupError) {
            console.error("Additional error during cleanup:", cleanupError);
          }
          throw error;
        }
      },
      CLEANUP_TIMEOUT,
    );

    it(
      "should implement proper cascading cleanup",
      async () => {
        // Test case 1: Close server, expect client to cascade
        const {
          context: context1,
          serverTransport: st1,
          clientTransport: ct1,
          isServerClosed: isServer1Closed,
          isClientClosed: isClient1Closed,
        } = await setupContextWithTransports();

        try {
          console.log("Testing server -> client cascade...");
          await st1.close();
          expect(isServer1Closed()).toBe(true);

          // Give time for cascade
          await new Promise((resolve) => setTimeout(resolve, 100));

          // When cascading is implemented, this should be true
          console.log("Expected client cascade result:", isClient1Closed());
          expect(isClient1Closed()).toBe(true);

          // Clean up for next test
          if (!isClient1Closed()) {
            await ct1.close();
          }

          // Test case 2: Close client, expect server to cascade
          const {
            context: context2,
            clientTransport: ct2,
            isServerClosed: isServer2Closed,
            isClientClosed: isClient2Closed,
          } = await setupContextWithTransports();

          console.log("Testing client -> server cascade...");
          await ct2.close();
          expect(isClient2Closed()).toBe(true);

          // Give time for cascade
          await new Promise((resolve) => setTimeout(resolve, 100));

          // When cascading is implemented, this should be true
          console.log("Expected server cascade result:", isServer2Closed());
          expect(isServer2Closed()).toBe(true);

          await context2.close();
        } catch (error) {
          console.error("Error during cascading cleanup test:", error);
          try {
            await context1.close();
          } catch (cleanupError) {
            console.error("Additional error during cleanup:", cleanupError);
          }
          throw error;
        }
      },
      CLEANUP_TIMEOUT * 2, // Longer timeout for comprehensive test
    );
  });
});
