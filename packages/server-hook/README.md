# @civic/server-hook

MCP hook that provides server-side initialization handling and callbacks for Model Context Protocol (MCP) applications.

## Overview

The ServerHook enables you to create MCP servers that respond to client initialization requests without requiring a backend MCP server. It handles the complete MCP initialization handshake, including protocol version validation, capability advertisement, and lifecycle callbacks.

## Features

- **Server-side Initialization**: Handle MCP client initialization requests with proper protocol compliance
- **Capability Advertisement**: Advertise server capabilities to connecting clients
- **Protocol Validation**: Automatic validation of MCP protocol versions
- **Lifecycle Callbacks**: Get notified when initialization is complete
- **Client Tracking**: Access client capabilities and version information after connection
- **TypeScript Support**: Full type safety with comprehensive type definitions

## Installation

```bash
npm install @civic/server-hook
```

## Quick Start

```typescript
import { ServerHook } from '@civic/server-hook';
import { PassthroughContext } from '@civic/passthrough-mcp-server';

// Create a server hook
const serverHook = new ServerHook({
  serverInfo: {
    name: "my-mcp-server",
    version: "1.0.0"
  },
  options: {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    instructions: "This server provides example functionality"
  },
  oninitialized: () => {
    console.log("Client has successfully initialized!");
  }
});

// Use with PassthroughContext for hooks-only operation
const context = new PassthroughContext([serverHook]);
```

## API Reference

### ServerHook

The main class that implements the MCP server initialization protocol.

#### Constructor

```typescript
new ServerHook(config: ServerHookConfig)
```

#### ServerHookConfig

```typescript
interface ServerHookConfig {
  // Server information (name, version)
  serverInfo: Implementation;
  
  // Optional server options
  options?: ServerHookOptions;
  
  // Callback when initialization is complete
  oninitialized?: () => void;
}
```

#### ServerHookOptions

```typescript
interface ServerHookOptions {
  // Capabilities to advertise
  capabilities?: ServerCapabilities;
  
  // Optional usage instructions
  instructions?: string;
}
```

### Properties

#### `serverInfo: Implementation` (readonly)
The server information provided during construction.

#### `options: ServerHookOptions | undefined` (readonly)
The server options provided during construction.

#### `isInitialized: boolean` (readonly)
Whether the client has completed the initialization handshake.

### Methods

#### `getClientCapabilities(): ClientCapabilities | undefined`
Returns the capabilities reported by the connected client, available after initialization.

#### `getClientVersion(): Implementation | undefined`
Returns the client name and version information, available after initialization.

#### `reset(): void`
Resets the initialization state (useful for testing or reconnection scenarios).

## Usage Examples

### Basic Server Hook

```typescript
import { ServerHook } from '@civic/server-hook';

const hook = new ServerHook({
  serverInfo: {
    name: "example-server",
    version: "1.0.0"
  },
  options: {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
});
```

### With Initialization Callback

```typescript
const hook = new ServerHook({
  serverInfo: {
    name: "callback-server", 
    version: "1.0.0"
  },
  oninitialized: () => {
    const clientInfo = hook.getClientVersion();
    const clientCaps = hook.getClientCapabilities();
    
    console.log(`Client ${clientInfo?.name} v${clientInfo?.version} connected`);
    console.log('Client capabilities:', clientCaps);
  }
});
```

### Hooks-Only MCP Server

```typescript
import { ServerHook } from '@civic/server-hook';
import { PassthroughContext } from '@civic/passthrough-mcp-server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Create server hook
const serverHook = new ServerHook({
  serverInfo: { name: "hooks-server", version: "1.0.0" },
  options: {
    capabilities: { tools: {}, resources: {}, prompts: {} }
  }
});

// Create custom tools hook
const toolsHook = {
  name: "CustomTools",
  async processListToolsRequest() {
    return {
      resultType: "respond",
      response: {
        tools: [
          {
            name: "greet",
            description: "Say hello",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } }
            }
          }
        ]
      }
    };
  },
  async processCallToolRequest(request) {
    if (request.params.name === "greet") {
      return {
        resultType: "respond",
        response: {
          content: [
            {
              type: "text", 
              text: `Hello, ${request.params.arguments?.name || "World"}!`
            }
          ]
        }
      };
    }
    return { resultType: "continue", request };
  }
};

// Create passthrough context with hooks
const context = new PassthroughContext([serverHook, toolsHook]);

// Set up transport and connect
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()
});

await context.connect(transport, undefined); // No client transport!

// Now your server can handle MCP requests entirely through hooks
```

## Integration with PassthroughContext

ServerHook is designed to work seamlessly with `@civic/passthrough-mcp-server` for creating MCP servers that operate entirely through hooks without requiring a backend server:

```typescript
// Hooks-only server - no backend needed!
const context = new PassthroughContext([
  serverHook,    // Handles initialization
  toolsHook,     // Handles tools
  resourcesHook, // Handles resources
  // ... other hooks
]);

await context.connect(serverTransport, undefined);
```

## Protocol Compliance

ServerHook implements the MCP initialization protocol correctly:

1. **Initialize Request**: Responds to `initialize` requests with server capabilities
2. **Protocol Validation**: Validates client protocol version against supported versions
3. **Initialized Notification**: Monitors for `notifications/initialized` from client
4. **Lifecycle Management**: Tracks initialization state and provides callbacks

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
import { ServerHook, ServerHookConfig } from '@civic/server-hook';
import { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';

const config: ServerHookConfig = {
  serverInfo: { name: "typed-server", version: "1.0.0" },
  options: {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    } satisfies ServerCapabilities
  }
};

const hook = new ServerHook(config);
```

## Testing

ServerHook includes comprehensive test coverage and provides utilities for testing:

```typescript
// Reset for clean test state
beforeEach(() => {
  serverHook.reset();
});

// Check initialization state
expect(serverHook.isInitialized).toBe(false);

// After client connects and initializes
expect(serverHook.isInitialized).toBe(true);
expect(serverHook.getClientVersion()?.name).toBe("test-client");
```

## Requirements

- Node.js 18+
- TypeScript 5.0+ (for TypeScript projects)
- @civic/hook-common v0.3.0+
- @modelcontextprotocol/sdk v1.17.1+

## License

MIT

## Contributing

Contributions are welcome! Please see the main repository for contribution guidelines.

## Related Packages

- [@civic/hook-common](../hook-common) - Common utilities and types for MCP hooks
- [@civic/passthrough-mcp-server](../passthrough-mcp-server) - MCP server with hook middleware support
- [@civic/local-tools-hook](../local-tools-hook) - Hook for adding local tools