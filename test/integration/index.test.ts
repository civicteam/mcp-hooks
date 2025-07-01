import { describe, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG } from './test-config';

// Import all test suites
import './auth.test';
import './session.test';
import './streaming.test';
import './ping.test';

describe('MCP Passthrough Integration Tests', () => {
  beforeAll(async () => {
    console.log('Starting MCP Passthrough Integration Tests');
    console.log('Test Configuration:');
    console.log('- Target server (no auth):', TEST_CONFIG.targetServers.withoutAuth.url);
    console.log('- Target server (with auth):', TEST_CONFIG.targetServers.withAuth.url);
    console.log('- Passthrough server (no auth):', TEST_CONFIG.passthroughServers.withoutAuth.url);
    console.log('- Passthrough server (with auth):', TEST_CONFIG.passthroughServers.withAuth.url);
    
    // Verify servers are running
    const serversToCheck = [
      TEST_CONFIG.passthroughServers.withoutAuth.url,
      TEST_CONFIG.passthroughServers.withAuth.url,
    ];

    for (const serverUrl of serversToCheck) {
      try {
        const response = await fetch(`${serverUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        }).catch(() => null);
        
        if (!response || !response.ok) {
          console.warn(`Warning: Server at ${serverUrl} may not be running`);
        }
      } catch (error) {
        console.warn(`Warning: Could not reach server at ${serverUrl}`);
      }
    }
  });

  afterAll(async () => {
    console.log('Completed MCP Passthrough Integration Tests');
  });
});