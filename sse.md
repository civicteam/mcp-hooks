# SSE Streaming in MCP Passthrough Server

## Overview

The MCP Passthrough Server correctly handles Server-Sent Events (SSE) streaming to support the Model Context Protocol (MCP) SDK's `StreamableHTTPClientTransport`. This document describes how SSE streaming works in the passthrough architecture.

## Architecture

### Current State
- Client sends JSON requests with Accept: application/json, text/event-stream
- Passthrough forwards JSON to target server
- Target server responds with SSE format (text/event-stream)
- Passthrough parses SSE response back to JSON before sending to client
- This breaks streaming and doesn't support server-sent events like pings

### Target State
- Client sends JSON requests accepting SSE responses
- Passthrough forwards requests and maintains streaming connection
- Target server responds with SSE stream
- Response streams back through passthrough to client in SSE format
- Server-sent events (like pings) flow through naturally
- Hooks are applied by parsing SSE events only when needed

## Data Flow

```
Client (JSON) → Passthrough → Target (JSON)
                    ↓              ↓
             Process hooks    SSE Response
                    ↓              ↓
             Forward request  Stream back
                              (parse for hooks)
```

## Implementation

The passthrough server handles SSE streaming transparently:

### 1. Request Flow
- Client sends JSON requests with `Accept: application/json, text/event-stream`
- Passthrough forwards JSON requests to target server
- Target server may respond with either JSON or SSE format based on Accept header

### 2. Response Handling
When the target server responds with SSE (`Content-Type: text/event-stream`):
- The `StreamingMessageHandler` detects the SSE response
- Response headers are forwarded to the client (preserving session IDs, etc.)
- The SSE stream is piped directly from target to client
- No parsing or modification of the SSE stream occurs (true streaming)

### 3. Hook Integration
For requests that need hook processing (tools/call, tools/list):
- The `MessageHandler` processes the request through hooks before forwarding
- Response is handled as JSON (not streamed)
- This ensures hooks can inspect and modify tool calls

### 4. Session Management
- Session IDs from target servers are preserved in response headers
- Clients include session IDs in subsequent requests
- Passthrough forwards all headers transparently

## Key Features

### Server-Sent Events Support
- Target servers can send events at any time (e.g., pings)
- Events flow through the passthrough without buffering
- Maintains real-time nature of SSE

### Stateless Architecture
- Passthrough doesn't maintain session state
- All state is managed by target servers
- Simplifies scaling and reliability

### Performance
- Direct streaming minimizes latency
- No buffering or parsing of SSE data
- Efficient memory usage for long-running connections

## Testing

Integration tests verify:
1. SSE responses are properly forwarded
2. Session IDs are preserved
3. Server-sent pings reach clients
4. Multiple concurrent sessions work independently
5. Authentication tokens are passed through correctly