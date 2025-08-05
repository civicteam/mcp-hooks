# Changelog

All notable changes to the `@civic/passthrough-mcp-server` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-01

### Added

- Initial release of the passthrough SDK for implementing MCP passthrough servers
- Server and client protocol implementations for bidirectional message routing
- Session context management with `PassthroughSessionContext` for isolated session handling
- Context coordination with `PassthroughContext` for managing server/client lifecycle
- Built on Model Context Protocol (MCP) SDK transport abstraction
- Comprehensive test coverage including unit and integration tests
- Support for graceful shutdown and cascading transport closure
- Protocol-level coordination between server and client sides
- Built on Model Context Protocol (MCP) SDK v1.17.0

### Features

- **PassthroughServer**: Server-side protocol implementation handling incoming client requests
- **PassthroughClient**: Client-side protocol implementation forwarding requests to upstream servers
- **PassthroughContext**: Manages server/client protocol coordination and lifecycle
- **PassthroughSessionContext**: Provides isolated session management and cleanup
- **Transport Support**: Works with MCP SDK transports (HTTP streaming, stdio, custom)
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Cascading Cleanup**: Automatic resource cleanup when either transport closes

### Technical Details

- Built with TypeScript for type safety and full IDE support
- ESM module format with proper import/export syntax
- Minimum Node.js version: 18.0.0
- Full TypeScript type definitions included
- Zero side effects for optimal bundling
- Comprehensive integration tests covering stdio-to-HTTP and HTTP-to-HTTP scenarios
- Proper MCP protocol compliance with schema validation