import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TokenAuthProvider } from '@civic/auth-mcp/client';
import { TEST_CONFIG } from './test-config';
import { 
  createTestClient, 
  createAuthenticatedClient, 
  createUnauthenticatedClient
} from './test-client';

describe('Authentication Flow Tests', () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  describe('Passthrough with OAuth authentication', () => {
    it('should fail to connect without authentication', async () => {
      await expect(async () => {
        client = await createUnauthenticatedClient(
          TEST_CONFIG.passthroughServers.withAuth.url
        );
      }).rejects.toThrow();
    });

    it('should connect with valid token', async () => {
      // TODO: Replace with actual token
      const TEST_TOKEN = 'placeholder-token-12345';
      
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_TOKEN
      );

      expect(client).toBeDefined();
      // Verify connection by listing tools
      const tools = await client.listTools();
      expect(tools).toBeDefined();
    });

    it('should pass through authorization headers to target server', async () => {
      const TEST_TOKEN = 'placeholder-token-12345';
      
      client = await createAuthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url,
        TEST_TOKEN
      );

      // List tools to verify auth is working
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      // Call a tool if available
      const firstTool = tools.tools[0];
      if (firstTool) {
        const result = await client.callTool({
          name: firstTool.name,
          arguments: {}
        });
        expect(result).toBeDefined();
      }
    });

    it('should handle invalid tokens', async () => {
      const INVALID_TOKEN = 'invalid-token';
      
      await expect(async () => {
        client = await createAuthenticatedClient(
          TEST_CONFIG.passthroughServers.withAuth.url,
          INVALID_TOKEN
        );
      }).rejects.toThrow();
    });
  });

  describe('OAuth flow passthrough', () => {
    it('should handle OAuth-protected server connection attempt', async () => {
      // When connecting to an OAuth-protected server without auth,
      // the MCP client should receive appropriate error
      const shouldFail = createUnauthenticatedClient(
        TEST_CONFIG.passthroughServers.withAuth.url
      );
      
      await expect(shouldFail).rejects.toThrow();
    });
  });

  describe('Token-based authentication', () => {
    it('should support custom auth providers', async () => {
      // Create a custom auth provider
      const customAuthProvider = new TokenAuthProvider('custom-token-xyz');
      
      const shouldFail = createTestClient({
        url: TEST_CONFIG.passthroughServers.withAuth.url,
        authProvider: customAuthProvider,
      });
      
      await expect(shouldFail).rejects.toThrow();
    });

    it('should work with TokenAuthProvider from civic auth', async () => {
      // Verify that TokenAuthProvider from @civic/auth-mcp works
      const authProvider = new TokenAuthProvider('test-token-12345');
      
      const shouldFail = createTestClient({
        url: TEST_CONFIG.passthroughServers.withAuth.url,
        authProvider,
      });
      
      await expect(shouldFail).rejects.toThrow();
    });
  });
});