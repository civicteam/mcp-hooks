# @civic/passthrough-mcp-server

SDK for implementing Model Context Protocol (MCP) passthrough servers with flexible transport and protocol handling.

## Overview

The passthrough SDK provides a framework for building MCP servers that act as intermediaries between MCP clients and upstream MCP servers. It handles the complexities of bidirectional message routing, session management, and transport abstraction.

## Installation

```bash
pnpm add @civic/passthrough-mcp-server
```

## Features

- **Bidirectional Protocol Handling**: Seamlessly routes messages between clients and upstream servers
- **Session Isolation**: Each client connection gets its own isolated session context
- **Transport Abstraction**: Support for multiple transport types (HTTP, stdio, custom)
- **Graceful Shutdown**: Proper cleanup and cascading transport closure
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Extensible Architecture**: Easy to extend with custom transports and protocols

## Core Components

### PassthroughServer & PassthroughClient

Server and client protocol implementations that handle MCP message routing. The PassthroughServer manages incoming requests from clients, while the PassthroughClient forwards those requests to upstream servers.

### PassthroughContext

Manages the lifecycle and coordination between server and client protocol instances.

### PassthroughSessionContext

Provides isolated session management for each client connection, ensuring proper resource cleanup and session isolation.

### Transport Layer

Built on the MCP SDK transport abstraction, supporting:
- HTTP streaming via StreamableHTTPClientTransport
- stdio (standard input/output) via StdioServerTransport
- Custom transport implementations via the Transport interface

## Usage

### Basic Passthrough Server

```typescript
import { PassthroughContext } from '@civic/passthrough-mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Create context for managing server/client coordination
const context = new PassthroughContext();

// Set up server transport (receives client connections)
const serverTransport = new StdioServerTransport();

// Set up client transport (connects to upstream server)
const clientTransport = new StreamableHTTPClientTransport(
  new URL('http://upstream-server.example.com')
);

// Connect both transports to start passthrough
await context.connect(serverTransport, clientTransport);

// The passthrough will now route messages between clients and upstream server
```

### HTTP-to-HTTP Passthrough

```typescript
import { PassthroughContext } from '@civic/passthrough-mcp-server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const context = new PassthroughContext();

// Server transport listens for HTTP client connections
const serverTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()
});

// Client transport connects to upstream HTTP server
const clientTransport = new StreamableHTTPClientTransport(
  new URL('http://upstream-server.example.com')
);

await context.connect(serverTransport, clientTransport);
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

## Architecture

The passthrough SDK follows a layered architecture:

1. **Transport Layer**: Built on MCP SDK transports (HTTP, stdio, etc.)
2. **Protocol Layer**: PassthroughServer and PassthroughClient handle message routing
3. **Session Layer**: PassthroughSessionContext manages session lifecycle
4. **Context Layer**: PassthroughContext coordinates server and client instances

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
- Cleanup and error handling tests

Run tests with:
```bash
pnpm test
```

## Contributing

Contributions are welcome! Please see the main repository's contributing guidelines.

## License

MIT License - see the LICENSE file in the root of the repository.