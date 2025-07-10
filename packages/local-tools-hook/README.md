# @civic/local-tools-hook

A programmatic hook for adding local tools to passthrough MCP servers without requiring a separate MCP server.

## Overview

The Local Tools Hook allows you to define and add tools directly within your application code, making them available through the passthrough proxy alongside tools from remote MCP servers. This is useful when you want to:

- Add simple utility tools without the overhead of a full MCP server
- Integrate application-specific functionality as MCP tools
- Provide tools that need access to your application's runtime context

## Installation

```bash
npm install @civic/local-tools-hook
```

## Usage

### Basic Example

```typescript
import { LocalToolsHook } from '@civic/local-tools-hook';
import { createStdioPassthroughProxy } from '@civic/passthrough-mcp-server';
import { z } from 'zod';

// Define your local tools
const tools = [
  {
    name: "getCurrentTime",
    description: "Get the current time in ISO format",
    paramsSchema: {}, // Empty Zod schema for no parameters
    cb: async () => ({
      content: [{
        type: "text" as const,
        text: new Date().toISOString()
      }]
    })
  },
  {
    name: "addNumbers",
    description: "Add two numbers together",
    paramsSchema: {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number")
    },
    cb: async ({ a, b }) => ({
      content: [{
        type: "text" as const,
        text: `${a} + ${b} = ${a + b}`
      }]
    })
  }
];

// Create the hook
const localToolsHook = new LocalToolsHook(tools);

// Use with passthrough proxy
const proxy = await createStdioPassthroughProxy({
  target: {
    url: "http://localhost:3000",
    transportType: "httpStream"
  },
  hooks: [localToolsHook]
});
```

### Tool Definition

Each tool must have:

```typescript
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

interface ToolDefinition<Args extends ZodRawShape> {
  name: string;                          // Unique tool name
  description: string;                   // Tool description for LLMs
  paramsSchema: Args;                   // Zod schema for parameters
  cb: ToolCallback<Args>;               // Tool implementation callback
}
```

The callback (`cb`) receives the parsed arguments and a context object, and should return a `CallToolResult` with content:

```typescript
{
  content: [
    {
      type: "text" as const,
      text: "Your tool's response"
    }
  ]
}
```

### How It Works

1. **Tool Registration**: When the client requests the tools list, LocalToolsHook adds its tools to the list returned by the target server
2. **Tool Interception**: When a client calls a local tool, the hook intercepts the request and executes the handler
3. **Pass-through**: Requests for non-local tools are passed through to the target server

### Advanced Example with Application Context

```typescript
class ApplicationContext {
  private data: Map<string, any> = new Map();
  
  get(key: string): any {
    return this.data.get(key);
  }
  
  set(key: string, value: any): void {
    this.data.set(key, value);
  }
}

// Create tools that use application context
const createContextAwareTools = (context: ApplicationContext) => [
  {
    name: "getValue",
    description: "Get a value from the application context",
    paramsSchema: {
      key: z.string().describe("The key to retrieve")
    },
    cb: async ({ key }) => {
      const value = context.get(key);
      return {
        content: [{
          type: "text" as const,
          text: value ? JSON.stringify(value) : "Key not found"
        }]
      };
    }
  },
  {
    name: "setValue",
    description: "Set a value in the application context",
    paramsSchema: {
      key: z.string().describe("The key to set"),
      value: z.any().describe("The value to store")
    },
    cb: async ({ key, value }) => {
      context.set(key, value);
      return {
        content: [{
          type: "text" as const,
          text: `Set ${key} = ${JSON.stringify(value)}`
        }]
      };
    }
  }
];

// Use the context-aware tools
const appContext = new ApplicationContext();
const localToolsHook = new LocalToolsHook(createContextAwareTools(appContext));
```

## Integration with Passthrough Server

The LocalToolsHook is designed to work seamlessly with the passthrough MCP server:

- It implements the standard `Hook` interface from `@civic/hook-common`
- It can be mixed with other hooks (both local and remote)
- Tools are added transparently to the tools list
- Tool calls are handled with proper MCP protocol compliance

## License

MIT