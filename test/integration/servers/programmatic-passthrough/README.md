# Programmatic Passthrough Test Server

This is a test server used for integration testing of programmatic hooks in the passthrough MCP server.

## Features

- Demonstrates using programmatic hooks (Hook instances) instead of remote HTTP hooks
- Implements a simple `CallCounterHook` that:
  - Counts the number of tool call requests
  - Adds the current request count to each response

## Usage

```bash
# Start the server
PORT=34101 TARGET_SERVER_URL=http://localhost:33100 pnpm start
```

## Environment Variables

- `PORT`: The port to run the passthrough server on (default: 34101)
- `TARGET_SERVER_URL`: The URL of the target MCP server to proxy to (default: http://localhost:33100)

## Hook Implementation

The `CallCounterHook` extends `AbstractHook` and:
- Increments a counter in `processCallToolRequest`
- Adds a text content element with the count in `processCallToolResult`

This allows tests to verify that hooks are being executed by checking the response content.