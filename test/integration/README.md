# MCP Passthrough Integration Tests

This directory contains integration tests for the MCP passthrough server, focusing on authentication, session management, and streaming capabilities.

## Test Structure

- `auth.test.ts` - Tests OAuth authentication flow and authorization header passthrough
- `session.test.ts` - Tests MCP session ID handling and stateless proxy behavior
- `streaming.test.ts` - Tests session persistence and multiple operations
- `ping.test.ts` - Tests server-initiated ping forwarding through passthrough
- `test-client.ts` - MCP client utilities with auth provider support
- `test-config.ts` - Configuration for test servers and endpoints

## Prerequisites

Before running the tests, ensure you have the following servers running:

### Target MCP Servers
1. **Non-authenticated server** on port 33000 (fetch-docs)
2. **OAuth-authenticated server** on port 33008 (whoami-server)
3. **Echo test server** on port 33100 (for ping testing)

### Passthrough Servers
1. **Passthrough to non-auth target** on port 34000
2. **Passthrough to auth target** on port 34008
3. **Passthrough to echo server** on port 34100

## Running the Tests

```bash
# Navigate to the integration test directory
cd test/integration

# Install dependencies (first time only)
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test suite
pnpm test auth.test.ts
pnpm test session.test.ts
pnpm test streaming.test.ts

# Run with verbose output
pnpm test -- --reporter=verbose
```

## Setting Up Test Servers

The easiest way to set up all required servers is to use the provided setup script:

```bash
# From the project root, build all packages first
pnpm build

# Then run the setup script
./test/integration/setup-test-servers.sh
```

This will start:
- fetch-docs server on port 33000 (no authentication)
- whoami-server on port 33008 (with Civic Auth)
- echo-test-server on port 33100 (for ping testing)
- Passthrough server on port 34000 (pointing to fetch-docs)
- Passthrough server on port 34008 (pointing to whoami-server)
- Passthrough server on port 34100 (pointing to echo-test-server)

To stop all servers, press Ctrl+C in the terminal running the setup script.

## Test Scenarios Covered

### Authentication Tests
- 401 response passthrough
- Authorization header forwarding
- OAuth flow endpoint passthrough
- Auth token configuration from environment

### Session Management Tests
- Session ID header passthrough
- Stateless proxy behavior
- Multiple concurrent sessions
- Session termination handling
- Session resilience after errors

### Session Persistence Tests
- Multiple tool calls without re-initialization
- Session continuity across operations
- Error recovery within sessions
- Concurrent session handling

### Ping Handling Tests
- Server-initiated ping forwarding
- Ping handling during active sessions
- Multiple concurrent sessions with pings
- Session continuity after ping exchanges

## Environment Variables

You can customize test behavior with these environment variables:

- `OAUTH_CLIENT_ID` - OAuth client ID for authentication tests
- `AUTH_SERVER_URL` - OAuth authorization server URL

## Debugging

To debug failing tests:

1. Check that all required servers are running using the setup script
2. Enable verbose logging in passthrough servers by modifying the setup script to include DEBUG environment variable
3. Use test isolation:
   ```bash
   cd test/integration
   pnpm test auth.test.ts -t "specific test name"
   ```

## Adding New Tests

When adding new integration tests:

1. Create a new test file in this directory
2. Import it in `index.test.ts`
3. Use the utilities from `test-utils.ts` for consistency
4. Follow the existing patterns for test organization
5. Document any new server requirements

## Known Limitations

- Tests assume specific ports are available (33000, 33008, 33100, 34000, 34008, 34100)
- Some tests may fail if target servers don't implement full MCP spec
- Auth tests require actual valid tokens (placeholder tokens will fail)
- Ping timing tests may be flaky on slow systems