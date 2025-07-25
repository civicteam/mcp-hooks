# Civic MCP Hooks

A middleware layer for the Model Context Protocol (MCP) that enables monitoring, validation, and transformation of AI tool interactions.

## Understanding MCP and Why It Needs Hooks

### What is MCP?

The Model Context Protocol (MCP) is a standard that allows AI assistants (like Claude) to interact with external tools and services. Think of it as a universal language that lets AI models:
- Read and write files
- Query databases
- Call APIs
- Execute code
- Access various services

When you use an AI assistant with MCP, it can perform real actions on your behalf, making it incredibly powerful for automation and productivity.

### Why Add a Middleware Layer?

While MCP's power is exciting, it also raises important questions:
- **Security**: How do we ensure the AI only accesses what it should?
- **Auditing**: How do we track what actions were taken?
- **Control**: How do we prevent unintended or dangerous operations?
- **Customization**: How do we modify behavior for specific use cases?

This is where hooks come in. Just like web applications use middleware to handle authentication, logging, and request processing, MCP can benefit from a similar pattern.

### How This Solution Works

Our approach introduces a "passthrough server" that sits between the AI and the actual MCP tools:

```
AI Assistant ←→ Passthrough Server ←→ Target MCP Server
                       ↓↑
                    [Hooks]
```

Here's what happens when the AI wants to use a tool:

```
1. Request:  AI → Passthrough → Hook 1 → Hook 2 → ... → Target MCP Server
2. Response: AI ← Passthrough ← Hook 2 ← Hook 1 ← ... ← Target MCP Server
```

The passthrough server:
1. **Intercepts** all requests from the AI
2. **Processes** them through a chain of hooks
3. **Forwards** approved requests to the actual tool
4. **Returns** the response (also processed through hooks)

Each hook in the chain can:
- **Inspect** the request (What is the AI trying to do?)
- **Modify** the request (Change parameters, add context)
- **Approve or Reject** the request (Security and validation)
- **Perform side effects** (Audit logging, notifications, analytics)
- **Transform** the response (Format, filter, or enhance results)

### Real-World Examples

Why do we need MCP-specific hooks? It's about **separation of concerns** and the unique challenges of LLM tool use.

**The Core Problem**: MCP servers are designed to do one thing well - provide tools. They shouldn't be cluttered with authentication logic, audit trails, or context-specific modifications. Additionally, OAuth (which MCP uses) lacks the granularity needed for LLM interactions - there's no way to express "allow file reads but only in the /docs folder" or "allow API calls but rate-limit based on content."

**Example 1: LLM-Specific Guardrails**

Your MCP file server provides simple file operations. But LLMs need different rules than human users:

```
Human user: Can precisely click on files they need
LLM: Might try to read entire directory trees to "be helpful"

Guardrail Hook: Limits directory traversal depth, prevents reading 
binary files, and caps file sizes - rules that only make sense for LLMs
```

The MCP server stays simple, while the hook adds LLM-specific safety rails.

**Example 2: Context-Dependent Tool Descriptions and Prompts**

The same tool might need different descriptions for different use cases:

```
Standard fetch tool: "Retrieves web content"

In a research environment:
"Retrieves web content (academic sources preferred, checks Sci-Hub)"

In a corporate environment:
"Retrieves web content (internal wiki only, external sites blocked)"
```

The Custom Description Hook modifies tool descriptions based on your context - something the original MCP server can't and shouldn't handle.

**Example 3: Forcing Transparency with Explain Hook**

LLMs can use tools without explaining why. The Explain Hook adds a required "reason" parameter:

```
Without hook:
AI: execute_sql("DROP TABLE users")

With Explain Hook:
AI: execute_sql("DROP TABLE users", reason="User requested database cleanup")
```

This modification happens at the middleware layer - the MCP server doesn't need to change.

**Example 4: Semantic Audit Trails**

MCP servers return raw responses. An Audit Hook can add semantic meaning:

```
MCP Server returns: {status: "success", rowsAffected: 1523}

Audit Hook logs:
- Tool: database_query
- Action: "Bulk update customer emails"  
- Impact: 1523 records modified
- Context: "Part of migration from old email domain"
- Risk level: High (bulk data modification)
```

The MCP server remains focused on database operations while the hook handles compliance logging.

## Available Packages

This monorepo contains everything you need to add a middleware layer to MCP:

### Core Infrastructure

**@civic/passthrough-mcp-server**
The main proxy server that intercepts MCP traffic and routes it through your hooks. This is the foundation that makes everything else possible.

**@civic/hook-common**
Shared utilities and TypeScript types for building hooks. Provides the `AbstractHook` base class that makes creating new hooks straightforward.

### Example Hooks

**@civic/audit-hook**
Logs every request and response for debugging and compliance. Perfect for understanding what your AI is doing and maintaining an audit trail.

**@civic/guardrail-hook**
Implements security rules to filter and validate requests. Includes an example that prevents access to certain domains, but can be extended for any validation logic.

**@civic/simple-log-hook**
The simplest possible hook - just logs to console. Great starting point for understanding how hooks work and building your own.

**@civic/explain-hook**
Adds a "reason" parameter to all tools, encouraging the AI to explain why it's using each tool. Helpful for transparency and debugging.

**@civic/custom-description-hook**
Replaces tool descriptions based on configuration. Useful for providing context-specific information about what tools do in your environment.

**@civic/rate-limit-hook**
Enforces rate limits on tool calls per user. Configurable limits per minute and per hour with clear retry-after responses.

**@civic/alert-hook**
Monitors transport-layer errors and triggers alerts when server errors occur. Sends webhook notifications when 5xx HTTP errors are detected, useful for operational monitoring.

**@civic/local-tools-hook**
A programmatic hook that allows adding local tools directly to passthrough MCP servers without requiring a separate MCP server. Perfect for defining custom tools in your application code.

### Testing Tools

**@civic/fetch-docs**
A simple MCP server that fetches web pages and converts them to markdown. Included as a testing target for the passthrough server and hooks.

**@civic/whoami-server**
An MCP server that integrates with Civic Auth to identify authenticated users. Provides a "whoami" tool that returns information about the current user, useful for testing authentication flows.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Quick Start

1. **Clone and install:**
```bash
git clone https://github.com/civicteam/mcp-hooks.git
cd mcp-hooks
pnpm install
pnpm build
```

2. **Try the simple example:**
```bash
# Terminal 1: Start the fetch-docs MCP server
cd packages/fetch-docs
pnpm start

# Terminal 2: Start the audit hook
cd packages/audit-hook
pnpm start

# Terminal 3: Start the passthrough server
cd packages/passthrough-mcp-server
export TARGET_SERVER_URL="http://localhost:33005"
export HOOKS="http://localhost:33004"
pnpm start
```

Now any MCP client connecting to port 34000 will have all requests logged by the audit hook before being forwarded to the fetch-docs server.

### Testing with Included Examples

The `test/` directory contains ready-to-run configurations:

```bash
cd test
./test.sh simple-log-passthrough.json  # See basic logging in action
./test.sh audit-passthrough.json       # Test audit trail functionality
./test.sh guardrail-passthrough.json   # Test security filtering
```

## Creating Your Own Hook

Building a custom hook is straightforward:

1. **Create a new package:**
```bash
mkdir packages/my-hook
cd packages/my-hook
pnpm init
```

2. **Install dependencies:**
```bash
pnpm add @civic/hook-common @trpc/server
```

3. **Implement your hook:**
```typescript
import { AbstractHook, createHookRouter, ToolCallRequestHookResult } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

class MyHook extends AbstractHook {
  get name(): string {
    return "my-hook";
  }

  async processToolCallRequest(toolCall: CallToolRequest): Promise<ToolCallRequestHookResult> {
    // Your logic here
    console.log(`Processing: ${toolCall.params.name}`);
    
    // Continue with the request
    return {
      resultType: "continue",
      request: toolCall
    };
  }
}

// Start the server
const hook = new MyHook();
const router = createHookRouter(hook);
const server = createHTTPServer({ router, createContext: () => ({}) });
server.listen(33007);
```

4. **Use your hook:**
```bash
export HOOKS="http://localhost:33007"
pnpm start
```

## Advanced Configuration

### Multiple Hooks

Hooks can be chained together:

```bash
export HOOKS="http://localhost:33004,http://localhost:33005,http://localhost:33006"
```

They execute in order for requests and reverse order for responses.

### Hook Response Types

Hooks can return three types of responses:

- **continue**: Proceed with the (possibly modified) request
- **abort**: Stop processing and return an error
- **respond**: Return a response without calling the target server

### Environment Variables

- `PORT`: HTTP port for the passthrough server (default: 34000)
- `TARGET_SERVER_URL`: The MCP server to forward requests to
- `TARGET_SERVER_TRANSPORT`: Transport type (httpStream, sse, stdio)
- `HOOKS`: Comma-separated list of hook URLs

## Architecture Details

### Technology Stack

- **TypeScript**: Full type safety across all packages
- **tRPC**: Type-safe communication between hooks and server
- **fastMCP**: High-performance MCP server implementation
- **Turborepo**: Monorepo build orchestration
- **Biome**: Fast, modern linting and formatting
- **Vitest**: Unit testing framework

### Project Structure

```
mcp-hooks/
├── packages/
│   ├── passthrough-mcp-server/   # Main proxy server
│   ├── hook-common/              # Shared types and utilities
│   ├── audit-hook/               # Example: Logging hook
│   ├── guardrail-hook/           # Example: Security hook
│   ├── simple-log-hook/          # Example: Minimal hook
│   ├── explain-hook/             # Example: Transparency hook
│   ├── custom-description-hook/  # Example: Transform hook
│   ├── rate-limit-hook/          # Example: Rate limiting hook
│   ├── alert-hook/               # Example: Error alerting hook
│   ├── local-tools-hook/         # Example: Programmatic tools hook
│   ├── fetch-docs/               # Test MCP server
│   └── whoami-server/            # Test auth server
├── test/                         # Test configurations
└── docs/                         # Additional documentation
```

### Hook Interface

All hooks implement this simple interface:

```typescript
interface Hook {
  name: string;
  processToolCallRequest?(toolCall: CallToolRequest): Promise<ToolCallRequestHookResult>;
  processToolCallResponse?(response: CallToolResult, originalToolCall: CallToolRequest): Promise<ToolCallResponseHookResult>;
  processToolsList?(request: ListToolsRequest): Promise<ListToolsRequestHookResult>;
  processToolsListResponse?(response: ListToolsResult, originalRequest: ListToolsRequest): Promise<ListToolsResponseHookResult>;
  processToolCallTransportError?(error: unknown, originalToolCall: CallToolRequest): Promise<ToolCallTransportErrorHookResult>;
  processToolsListTransportError?(error: unknown, originalRequest: ListToolsRequest): Promise<ListToolsTransportErrorHookResult>;
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Commands

```bash
pnpm install          # Install dependencies
pnpm build           # Build all packages
pnpm test            # Run tests
pnpm lint            # Check code style
pnpm dev             # Start in watch mode
```

## License

MIT - See [LICENSE](LICENSE) for details.