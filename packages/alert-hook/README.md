# Alert Hook

MCP middleware hook that monitors transport-layer errors and triggers alerts when 5xx HTTP errors are detected.

## Features

- Monitors tool call and list tools transport errors
- Detects 5xx HTTP status codes (500-599)- Sends alerts to webhook endpoints
- Passes errors through unchanged (non-blocking)

## Configuration

The hook can be configured via environment variables:

- `PORT`: Port to run the hook server on (default: 33007)
- `ALERT_WEBHOOK_URL`: Webhook URL to send alerts to

## Alert Format

Alerts are sent as JSON with the following structure:

```json
{
  "type": "tool_call_error" | "tools_list_error",
  "tool": "tool-name", // Only for tool_call_error
  "error": {
    "message": "Error message",
    "status": 500,
    "statusCode": 500,
    "code": "ERROR_CODE",
    "stack": "Error stack trace"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the hook:
   ```bash
   pnpm build
   ```

3. Run the hook:
   ```bash
   pnpm start
   ```

   Or with configuration:
   ```bash
   ALERT_WEBHOOK_URL=https://example.com/alerts PORT=33007 pnpm start
   ```

## Development

Run in development mode with hot reload:
```bash
pnpm dev
```

Run tests:
```bash
pnpm test
```

## Integration

Configure your MCP passthrough server to include this hook in the chain. The hook will monitor all transport errors and alert on 5xx errors while passing all errors through unchanged.