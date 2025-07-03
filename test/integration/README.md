# MCP Passthrough Integration Tests

This directory contains integration tests for the MCP passthrough server, focusing on authentication, session management, and streaming capabilities.

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

## Setting Up Test Servers

The easiest way to set up all required servers is to use the provided setup script:

```bash
# From the project root, build all packages first
pnpm build

# Then run the setup script
./test/integration/setup-test-servers.sh
```

## Running the Tests

```bash
# Navigate to the integration test directory
cd test/integration

# Install dependencies (first time only)
pnpm install

# Run all tests
test:integration
```
<
## Debugging

To debug failing tests:

1. Check that all required servers are running using the setup script
2. Enable verbose logging in passthrough servers by modifying the setup script to include DEBUG environment variable
3. Use test isolation:
   ```bash
   cd test/integration
   pnpm test:integration auth.test.ts -t "specific test name"
   ```
