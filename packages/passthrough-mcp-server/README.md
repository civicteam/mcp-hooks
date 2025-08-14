# @civic/passthrough-mcp-server

A Model Context Protocol (MCP) server that acts as a passthrough proxy with protocol-level hook middleware support and **direct transport communication interfaces**.

## Features

- **Bidirectional Protocol Handling**: Seamlessly routes messages between clients and upstream servers
- **🆕 Direct Transport Communication**: New TransportInterface with `source` and `target` interfaces for bypassing passthrough flow
- **Protocol-Level Hook System**: tRPC-based hook system for request/response interception and modification at the MCP protocol level
- **Session Isolation**: Each client connection gets its own isolated session context with `targetSessionId` and `sourceSessionId`
- **Transport Abstraction**: Support for multiple transport types (HTTP streaming, stdio, custom)
- **Graceful Shutdown**: Proper cleanup and cascading transport closure
- **Type Safety**: Full TypeScript support with comprehensive type definitions and generics
- **Extensible Architecture**: Easy to extend with custom transports and hooks
- **MCP Authorization spec compliant**: Properly handles authentication and authorization
- **Comprehensive test coverage** with modular, testable architecture

## Installation

### As a Standalone Server

```bash
git clone <repository>
cd packages/passthrough-mcp-server
pnpm install
pnpm build
```

### As a Library

```bash
npm install @civic/passthrough-mcp-server
```

## Core Components

### PassthroughContext

Manages the lifecycle and coordination between server and client protocol instances. This is the main entry point for creating passthrough connections.

### PassthroughServer & PassthroughClient

Server and client protocol implementations that handle MCP message routing. The PassthroughServer manages incoming requests from clients, while the PassthroughClient forwards those requests to upstream servers.

### PassthroughSessionContext

Provides isolated session management for each client connection, ensuring proper resource cleanup and session isolation.

### Hook Chain System

Protocol-level hook processing that allows for:
- Request validation and modification before reaching the target server
- Response transformation after receiving from the target server
- Tool call filtering and security checks
- Audit logging and monitoring

### Transport Layer

Built on the MCP SDK transport abstraction, supporting:
- HTTP streaming via RequestContextAwareStreamableHTTPClientTransport
- stdio (standard input/output) via StdioServerTransport
- Custom transport implementations via the Transport interface

## Usage

### Standalone Server

```bash
# Start the server with default HTTP Stream transport
pnpm start

# Start with stdio transport
pnpm start:stdio

# Development mode with auto-reload
pnpm dev
```

### Configuration

The server can be configured through environment variables:

- `PORT`: HTTP port to listen on (default: 34000)
- `TARGET_SERVER_URL`: URL of the target MCP server to connect to
- `TARGET_SERVER_TRANSPORT`: Transport type for connecting to the target server (httpStream, sse)
- `HOOKS`: Comma-separated list of tRPC hook server URLs for middleware processing
- `MCP_ENDPOINT`: Custom endpoint for MCP requests (default: /mcp)

#### Hook Middleware

You can specify multiple tRPC hook servers as middleware to process tool calls before they reach the target server:

```bash
# Single hook
HOOKS=http://localhost:33004 pnpm start

# Multiple hooks
HOOKS=http://localhost:33004,http://localhost:33005 pnpm start
```

Hook servers are processed in sequence, forming a middleware chain:
- **Requests**: Processed in order (first to last)
- **Responses**: Processed in reverse order (last to first)

Each hook can:
1. Allow the tool call to proceed (potentially with modifications)
2. Reject the tool call, preventing it from reaching the target server

This is useful for implementing validation, security checks, audit logging, or transformations.

## Programmatic Usage

The passthrough MCP server can be used programmatically in your Node.js applications.

### Basic Passthrough Server

```typescript
import { PassthroughContext, RequestContextAwareStreamableHTTPClientTransport } from '@civic/passthrough-mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Create context for managing server/client coordination
const context = new PassthroughContext();

// Set up server transport (receives client connections)
const serverTransport = new StdioServerTransport();

// Set up client transport (connects to upstream server)
const clientTransport = new RequestContextAwareStreamableHTTPClientTransport(
  new URL('http://upstream-server.example.com')
);

// Connect both transports to start passthrough
await context.connect(serverTransport, clientTransport);

// The passthrough will now route messages between clients and upstream server
```

### HTTP-to-HTTP Passthrough

```typescript
import { PassthroughContext, RequestContextAwareStreamableHTTPClientTransport } from '@civic/passthrough-mcp-server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const context = new PassthroughContext();

// Server transport listens for HTTP client connections
const serverTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()
});

// Client transport connects to upstream HTTP server
const clientTransport = new RequestContextAwareStreamableHTTPClientTransport(
  new URL('http://upstream-server.example.com')
);

await context.connect(serverTransport, clientTransport);
```

### With Hook Middleware

```typescript
import { PassthroughContext } from '@civic/passthrough-mcp-server';
// ... other imports

const context = new PassthroughContext();

// Configure hook chain
const hookChain = new HookChain([
  { url: "http://localhost:33004", name: "audit-hook" },
  { url: "http://localhost:33005", name: "security-hook" }
]);

// Set up transports and connect with hooks
await context.connect(serverTransport, clientTransport, { hookChain });
```

### Session Management

```typescript
import { PassthroughContext } from '@civic/passthrough-mcp-server';

const context = new PassthroughContext();

// Set up callbacks for connection lifecycle
context.onclose = () => {
  console.log('Passthrough connection closed');
};

context.onerror = (error) => {
  console.error('Passthrough error:', error);
};

// Sessions are automatically managed by the context
await context.connect(serverTransport, clientTransport);

// Clean up when done
await context.close();
```

## New in v0.7.2: Direct Transport Communication

**TransportInterface** provides direct access to connected transports, enabling advanced use cases beyond the standard passthrough flow:

```typescript
import { PassthroughContext, type TransportInterface } from '@civic/passthrough-mcp-server';

const context = new PassthroughContext();
await context.connect(serverTransport, clientTransport);

// Direct communication with connected clients
const toolsList = await context.source.request(
  { method: "tools/list", params: {} },
  ListToolsResultSchema
);

// Direct communication with target server  
await context.target.notification({
  method: "status/update",
  params: { status: "ready" }
});

// Direct ping capabilities
await context.source.ping();  // Ping connected clients
await context.target.ping();  // Ping target server
```

**Key Benefits:**
- **Bypass passthrough flow**: Direct server-to-client communication
- **Custom implementations**: Build advanced ping handling, notifications, etc.
- **Fine-grained control**: Access raw transport capabilities  
- **Type safety**: Full TypeScript support with generics

**Breaking Change in v0.7.2**: Metadata structure now includes both `targetSessionId` and `sourceSessionId` instead of single `sessionId`.

### Direct Communication via Source and Target Interfaces

PassthroughContext exposes `source` and `target` interfaces that allow direct communication with connected transports. Both interfaces implement the same `TransportInterface`:

```typescript
import { PassthroughContext, type TransportInterface } from '@civic/passthrough-mcp-server';
import { ListToolsRequestSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

const context = new PassthroughContext();
await context.connect(serverTransport, clientTransport);

// Send requests and notifications to connected clients (via source/server interface)
const toolsList = await context.source.request(
  { method: "tools/list", params: {} },
  ListToolsResultSchema
);

await context.source.notification({
  method: "tools/updated", 
  params: { message: "Tools have been updated" }
});

// Send ping to connected clients
await context.source.ping();

// Get direct access to the server transport
const serverTransport = context.source.transport();

// Send requests and notifications to the target server (via target/client interface)  
const targetTools = await context.target.request(
  { method: "tools/list", params: {} },
  ListToolsResultSchema
);

await context.target.notification({
  method: "status/update",
  params: { status: "ready" }
});

// Send ping to target server
await context.target.ping();

// Get direct access to the client transport
const clientTransport = context.target.transport();
```

#### Error Handling

Both interfaces throw `McpError` with code `REQUEST_REJECTED` when the respective transport is not connected:

```typescript
import { McpError } from '@modelcontextprotocol/sdk/types.js';

try {
  // This will throw if no client transport is connected
  await context.target.request(
    { method: "tools/list", params: {} },
    ListToolsResultSchema
  );
} catch (error) {
  if (error instanceof McpError && error.code === "REQUEST_REJECTED") {
    console.error("No client transport connected:", error.message);
  }
}
```

#### Interface Destructuring

The interfaces maintain proper `this` binding when destructured:

```typescript
const { request: sourceRequest, notification: sourceNotify, ping: sourcePing, transport: sourceTransport } = context.source;
const { request: targetRequest, notification: targetNotify, ping: targetPing, transport: targetTransport } = context.target;

// These work correctly even when destructured
await sourceRequest({ method: "test", params: {} }, TestSchema);
await targetNotify({ method: "status", params: { ready: true } });
await sourcePing();
await targetPing();

// Access to underlying transports
const serverTransport = sourceTransport(); // Returns Transport | undefined
const clientTransport = targetTransport(); // Returns Transport | undefined
```

### Target Configuration

The `TargetConfig` interface uses discriminated unions for type safety, ensuring only valid properties are available for each transport type:

#### HTTP Stream or SSE Transport
```typescript
{
  transportType: "httpStream" | "sse";
  url: string;                    // Target server URL
  mcpPath?: string;              // MCP endpoint path (defaults to "/mcp")
}
```

#### Custom Transport Factory
```typescript
{
  transportType: "custom";
  transportFactory: () => Transport;  // Factory function returning custom transport
}
```

#### Example Usage
```typescript
// HTTP/SSE transport configuration
const httpConfig = {
  target: {
    transportType: "httpStream" as const,
    url: "http://localhost:33000",
    mcpPath: "/api/mcp"  // Custom endpoint path
  }
};

// Custom transport configuration
const customConfig = {
  target: {
    transportType: "custom" as const,
    transportFactory: () => new MyCustomTransport({
      endpoint: "ws://localhost:8080",
      protocols: ["mcp"]
    })
  }
};
```

### High-Level API with createPassthroughProxy

For simplified usage, the package exports a high-level `createPassthroughProxy` function:

```typescript
import { createPassthroughProxy, loadConfig } from '@civic/passthrough-mcp-server';

// Load configuration from environment
const config = loadConfig();

// Create proxy with new structured config
const proxy = await createPassthroughProxy({
  source: {
    transportType: "httpStream",
    port: 34000,
    mcpPath: "/mcp" // Optional, defaults to /mcp
  },
  target: {
    transportType: "httpStream",
    url: "http://localhost:33000",
    mcpPath: "/mcp" // Optional, defaults to /mcp
  },
  hooks: [
    { url: "http://localhost:33004", name: "audit-hook" }
  ]
});

// Later, stop the proxy
await proxy.stop();
```

### Transport-Specific Functions

You can also use transport-specific functions for more explicit control:

```typescript
import { 
  createHttpPassthroughProxy, 
  createStdioPassthroughProxy 
} from '@civic/passthrough-mcp-server';

// HTTP passthrough proxy
const httpProxy = await createHttpPassthroughProxy({
  port: 34000,
  mcpPath: "/mcp",
  target: {
    transportType: "httpStream",
    url: "http://localhost:33000"
  },
  hooks: [
    { url: "http://localhost:33004", name: "audit-hook" }
  ]
});

// Stdio passthrough proxy  
const stdioProxy = await createStdioPassthroughProxy({
  target: {
    transportType: "httpStream", 
    url: "http://localhost:33000"
  },
  authToken: "optional-auth-token"
});
```

## Hook API

The passthrough server provides a comprehensive API for applying hooks to requests and responses, making it easy to integrate hook functionality into other services.

### Key Features

- **Protocol-level hook processing**: Direct exports from the processor module for applying hooks at the MCP protocol level
- **Hook creation utilities**: Functions for creating and managing hook clients
- **Type exports**: All necessary types are re-exported for convenience
- **AbstractHook base class**: Simplifies creating custom local hooks

### Hook-Related Exports

- `processCallToolRequestThroughHooks` - Process tool call requests through a chain of hooks
- `processCallToolResultThroughHooks` - Process tool call responses through hooks in reverse order
- `processListToolsRequestThroughHooks` - Process list tools requests through hooks
- `processListToolsResponseThroughHooks` - Process list tools responses through hooks
- `createHookClient` - Create a hook client instance from a hook definition
- `createHookClients` - Create multiple hook client instances
- `AbstractHook` - Base class for implementing custom hooks

## Authorization Support

The passthrough server is fully compliant with the MCP authorization specification:

### 401 Passthrough
For `httpStream` and `sse` transports, the server checks if the target MCP server returns a 401 response. If it does, the 401 response is passed through directly to the client, allowing proper authentication flows.

### Request Routing
- **MCP requests** (on `/mcp` endpoint): Handled by the MCP protocol handler
- **Non-MCP requests** (all other paths): Proxied directly to the target server

### Authorization Header Forwarding
Any authorization headers present in incoming requests are automatically forwarded to the target server, ensuring that authentication credentials are properly passed through the proxy chain.

## Architecture

The passthrough SDK follows a layered architecture:

1. **Transport Layer**: Built on MCP SDK transports (HTTP, stdio, etc.)
2. **Protocol Layer**: PassthroughServer and PassthroughClient handle message routing
3. **Hook Layer**: HookChain processes requests/responses through middleware
4. **Session Layer**: PassthroughSessionContext manages session lifecycle
5. **Context Layer**: PassthroughContext coordinates all components

## Creating Custom Hooks

To create a custom hook:

1. Install `@civic/hook-common` as a dependency
2. Extend the `AbstractHook` class and implement the `name` getter
3. Override the hook methods you need (processCallToolRequest, processCallToolResult, etc.)
4. For remote hooks: Create a tRPC server using `createHTTPServer` and `createHookRouter`
5. For local hooks: Pass the hook instance directly to the hook chain

See the audit-hook and guardrail-hook packages for remote hook examples.

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for development)

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Testing

The SDK includes comprehensive test coverage:
- Unit tests for individual components
- Integration tests for end-to-end scenarios
- Hook chain processing tests
- Cleanup and error handling tests

Run tests with:
```bash
pnpm test
```

## Example Setup

```bash
# Terminal 1: Start a target MCP server (e.g., sample-mcp-server)
cd ../sample-mcp-server
pnpm start

# Terminal 2: Start hook servers
cd ../audit-hook
pnpm start  # Port 33004

# Terminal 3: Start another hook
cd ../guardrail-hook
pnpm start  # Port 33005

# Terminal 4: Start passthrough with hooks
cd ../passthrough-mcp-server
export TARGET_SERVER_URL=http://localhost:3000
export HOOKS=http://localhost:33004,http://localhost:33005
pnpm start
```

Now clients can connect to the passthrough server on port 34000, and all requests will be:
1. Logged by the audit hook
2. Validated by the guardrail hook
3. Forwarded to the target server

## Migration Guide

### Upgrading from v0.7.1 to v0.7.2

**Breaking Change: Metadata Structure**

The metadata structure in `_meta` has been updated to include both session IDs:

**Before (v0.7.1):**
```typescript
// Hook accessing session ID
const sessionId = request.params._meta?.sessionId;
```

**After (v0.7.2):**
```typescript  
// Hook accessing session IDs
const targetSessionId = request.params._meta?.targetSessionId;  // Client transport session
const sourceSessionId = request.params._meta?.sourceSessionId;  // Server transport session

// For backward compatibility, use fallback pattern:
const sessionId = targetSessionId || sourceSessionId || "default";
```

**New Capabilities:**
- Access to `context.source` and `context.target` interfaces
- Direct transport communication without passthrough flow
- Enhanced ping functionality and custom implementations

### Upgrading from v0.7.0 to v0.7.1

If you're upgrading from v0.7.0, the configuration interface has been updated to use nested `source` and `target` objects:

**Before (v0.7.0):**
```typescript
const proxy = await createPassthroughProxy({
  sourceTransportType: "httpStream",
  port: 3000,
  sourceMcpPath: "/mcp",
  target: {
    url: "http://localhost:3001",
    transportType: "httpStream"
  }
});
```

**After (v0.7.1):**
```typescript
const proxy = await createPassthroughProxy({
  source: {
    transportType: "httpStream",
    port: 3000,
    mcpPath: "/mcp"
  },
  target: {
    url: "http://localhost:3001",
    transportType: "httpStream"
  }
});
```

## Contributing

Contributions are welcome! Please see the main repository's contributing guidelines.

## License

MIT License - see the LICENSE file in the root of the repository.