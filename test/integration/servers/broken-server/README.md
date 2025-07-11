# Broken MCP Server

This is a test server that always returns HTTP 500 errors. It's used for testing error handling in the passthrough proxy and hooks.

## Features

- Always returns HTTP 500 Internal Server Error
- Returns proper JSON-RPC error responses
- Logs all incoming requests
- Used for testing transport error handling hooks

## Usage

```bash
# Build
pnpm build

# Run on default port (33200)
pnpm start

# Run on custom port
PORT=3201 pnpm start

# Development mode
pnpm dev
```

## Testing

This server is used in integration tests to verify that:
1. The passthrough proxy correctly handles transport errors
2. Transport error hooks are called with the error information
3. Alert hooks can detect and notify about 5xx errors