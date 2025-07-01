import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TEST_CONFIG } from './test-config';
import { createUnauthenticatedClient, createAuthenticatedClient } from './test-client';
import {PingRequestSchema} from "@modelcontextprotocol/sdk/types.js";

// Type for tool call results
interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

describe('Ping Handling Tests', () => {
  let client: Client | undefined;
  const echoServerUrl = 'http://localhost:33100';
  const passthroughUrl = 'http://localhost:34100/mcp';

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe('Direct echo server connection', () => {
    it('should handle server-initiated pings', async () => {
      const pings: any[] = [];
      
      // Connect directly to echo server
      client = await createUnauthenticatedClient(`${echoServerUrl}/mcp`);
      
      // Set up request handler to capture pings
      client.setRequestHandler(PingRequestSchema, async (request) => {
        console.log('Client received request:', request.method);
        if (request.method === 'ping') {
          pings.push(request);
          return {}; // Respond to ping
        }
        throw new Error(`Unhandled request: ${request.method}`);
      });

      // List tools to establish session
      await client.listTools();

      // Call the echo tool
      // const result = await client.callTool({
      //   name: 'echo',
      //   arguments: {
      //     message: 'Hello from test',
      //   }
      // });
      // expect((result as ToolResult).content[0].text).toBe('Echo: Hello from test');
      //
      // // No pings yet
      // expect(pings).toHaveLength(0);

      console.log("Calling tool")

      // Trigger a ping from the server using the special tool
      const pingResult = await client.callTool({
        name: 'trigger-ping',
        arguments: {}
      });
      expect((pingResult as ToolResult).content[0].text).toBe('Ping triggered');

      console.log("waiting for ping")

      // Wait for the ping to arrive
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify ping was received
      expect(pings).toHaveLength(1);
      expect(pings[0].method).toBe('ping');
    });

    it('should track tool call count correctly', async () => {
      client = await createUnauthenticatedClient(`${echoServerUrl}/mcp`);

      // Make multiple tool calls
      for (let i = 1; i <= 3; i++) {
        const result = await client.callTool({
          name: 'echo',
          arguments: {
            message: `Message ${i}`,
          }
        });
        expect((result as ToolResult).content[0].text).toBe(`Echo: Message ${i}`);
      }

      // Tool calls should work correctly
      // Note: We can't verify server-side count without access to the server
    });
  });

  describe('Ping handling through passthrough', () => {
    it('should forward pings from target server to client', async () => {
      const pings: any[] = [];
      
      // Connect through passthrough server
      client = await createUnauthenticatedClient(passthroughUrl);
      
      // Set up request handler to capture pings
      client.setRequestHandler(PingRequestSchema, async (request) => {
        console.log('Client received request through passthrough:', request.method);
        if (request.method === 'ping') {
          pings.push(request);
          return {}; // Respond to ping
        }
        throw new Error(`Unhandled request: ${request.method}`);
      });

      // List tools to establish session
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(2);
      expect(tools.tools.map(t => t.name)).toContain('echo');
      expect(tools.tools.map(t => t.name)).toContain('trigger-ping');

      // Call the echo tool
      const result1 = await client.callTool({
        name: 'echo',
        arguments: {
          message: 'Hello through passthrough',
        }
      });
      expect((result1 as ToolResult).content[0].text).toBe('Echo: Hello through passthrough');

      // No pings yet
      expect(pings).toHaveLength(0);

      // Trigger a ping through the passthrough
      const pingResult = await client.callTool({
        name: 'trigger-ping',
        arguments: {}
      });
      expect((pingResult as ToolResult).content[0].text).toBe('Ping triggered');

      // Wait for the ping to be forwarded through passthrough
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify ping was received through passthrough
      expect(pings).toHaveLength(1);
      expect(pings[0].method).toBe('ping');

      // Make another tool call to verify session is still valid after ping
      const result2 = await client.callTool({
        name: 'echo',
        arguments: {
          message: 'Still working after ping',
        }
      });
      expect((result2 as ToolResult).content[0].text).toBe('Echo: Still working after ping');
    });

    it('should maintain session continuity when handling operations', async () => {
      client = await createUnauthenticatedClient(passthroughUrl);
      
      client.setRequestHandler(PingRequestSchema, async (request) => {
        if (request.method === 'ping') {
          return {};
        }
        throw new Error(`Unhandled request: ${request.method}`);
      });

      // Make multiple tool calls and verify session persists
      const messages = [
        'First message',
        'Second message',
        'Third message',
        'Fourth message',
      ];

      for (let i = 0; i < messages.length; i++) {
        const result = await client.callTool({
          name: 'echo',
          arguments: {
            message: messages[i],
          }
        });
        expect((result as ToolResult).content[0].text).toBe(`Echo: ${messages[i]}`);
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it('should handle concurrent sessions independently', async () => {
      const client1 = await createUnauthenticatedClient(passthroughUrl);
      const client2 = await createUnauthenticatedClient(passthroughUrl);

      try {
        // Set up ping handlers for both clients
        client1.setRequestHandler(PingRequestSchema, async (request) => {
          if (request.method === 'ping') {
            return {};
          }
          throw new Error(`Unhandled request: ${request.method}`);
        });

        client2.setRequestHandler(PingRequestSchema, async (request) => {
          if (request.method === 'ping') {
            return {};
          }
          throw new Error(`Unhandled request: ${request.method}`);
        });

        // Make tool calls on both clients
        const [result1, result2] = await Promise.all([
          client1.callTool({ name: 'echo', arguments: { message: 'Client 1' } }),
          client2.callTool({ name: 'echo', arguments: { message: 'Client 2' } }),
        ]);

        expect((result1 as ToolResult).content[0].text).toBe('Echo: Client 1');
        expect((result2 as ToolResult).content[0].text).toBe('Echo: Client 2');

        // Make more calls to verify sessions are independent
        const result1b = await client1.callTool({ name: 'echo', arguments: { message: 'Client 1 again' } });
        const result2b = await client2.callTool({ name: 'echo', arguments: { message: 'Client 2 again' } });

        expect((result1b as ToolResult).content[0].text).toBe('Echo: Client 1 again');
        expect((result2b as ToolResult).content[0].text).toBe('Echo: Client 2 again');

      } finally {
        await Promise.all([
          client1.close(),
          client2.close(),
        ]);
      }
    });
  });
});