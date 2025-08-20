# Changelog

All notable changes to the `@civic/passthrough-mcp-server` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.3] - 2025-01-20

### Added

- **Error Processing Support**: Complete implementation of error callback processing through hook chains
  - Hooks can now intercept and process errors at every stage of request/response handling
  - Error callbacks are invoked in reverse order through the hook chain
  - Support for error transformation, recovery, and pass-through
- **Enhanced HookChain Processor**: Improved error handling capabilities
  - `processResponseThroughHooks` now accepts both response and error parameters
  - Automatic switching between error and response processing based on hook results
  - When a hook recovers from an error, subsequent hooks see a successful response
- **toHookChainError Utility**: Standardized error conversion function
  - Converts various error types (McpError, Error, objects, primitives) to HookChainError
  - Preserves error codes, messages, and additional data
  - Ensures consistent error handling throughout the system
- **Comprehensive Integration Tests**: New test suite for error callback scenarios
  - Tests for single-hook error processing (transform, recover, pass-through)
  - Tests for multi-hook error chains with proper ordering
  - Validation of error recovery converting to successful responses

### Changed

- Updated to use @civic/hook-common v0.4.2 with error processing methods
- Enhanced `PassthroughContext` to handle error callbacks from hooks
- Improved processor functions to support bidirectional error/response processing
- Better error propagation and handling throughout the hook chain

### Technical Details

- Error callbacks enable sophisticated error handling strategies
- Hooks can implement retry logic, fallback responses, or error enrichment
- Full backward compatibility maintained with existing hook implementations
- TypeScript support ensures type-safe error handling

## [0.8.2] - 2025-08-19

### Added

- Support for `RequestExtra` parameter in all hook processing
  - Passes `requestId` and `sessionId` from MCP protocol layer to hooks
  - Enables request/response correlation and session tracking in hooks
- Integration test demonstrating request/response tracking by `requestId`
  - Shows how hooks can correlate requests with their responses
  - Validates session consistency across multiple requests
  - Demonstrates practical use cases for monitoring and logging

### Changed

- Updated to use @civic/hook-common v0.4.1 with `RequestExtra` support
- Hook processor functions now accept and pass `RequestExtra` parameter
- `PassthroughContext` creates `RequestExtra` from `RequestHandlerExtra`
  - Uses `requestId` from the protocol layer
  - Uses `sessionId` from `RequestHandlerExtra` for consistency
- All hook method calls updated to include `RequestExtra` parameter

### Technical Details

- Request IDs are incremental within a session (0, 1, 2, ...)
- Session IDs remain consistent throughout a client connection
- Enables stateless request/response tracking in distributed systems
- Supports advanced monitoring, rate limiting, and debugging capabilities

## [0.8.1] - 2025-08-18

### Added

- **PassthroughContextOptions**: New configuration interface for controlling metadata behavior
  - `appendMetadataToRequest`: Control whether metadata is added to requests (default: true)
  - `appendMetadataToResponse`: Control whether metadata is added to responses (default: true)
  - `appendMetadataToNotification`: Control whether metadata is added to notifications (default: true)
- **MetadataHelper**: New utility class that centralizes all metadata operations
- **PassthroughMetadata**: New interface defining the structure of metadata added to messages
- PassthroughContext now accepts options as second parameter: `new PassthroughContext(hooks, options)`

### Changed

- Metadata addition is now configurable and conditional based on options
- Refactored metadata logic from PassthroughContext into dedicated MetadataHelper class
- All metadata options default to `true` for backward compatibility

## [0.8.0] - 2025-08-14

### Changed

- Updated to use @civic/hook-common v0.4.0 with renamed hook result interfaces
- All internal references updated to use new `*HookResult` naming convention
- Improved code consistency with aligned interface naming
- No functional changes, only type import and reference updates

## [0.7.2] - 2025-08-14

### Added
- **TransportInterface**: New interface with `request()`, `notification()`, `ping()`, and `transport()` methods
- **`context.source`**: Direct communication interface to connected clients  
- **`context.target`**: Direct communication interface to target server
- Export TransportInterface, SourceInterface, and TargetInterface types

### Changed
- **BREAKING**: `_meta.sessionId` → `_meta.targetSessionId` + `_meta.sourceSessionId`
  - `targetSessionId`: Session ID of the target transport (client-side)  
  - `sourceSessionId`: Session ID of the source transport (server-side)
- Updated HTTP proxy integration to use new transport interfaces

### Use Cases Enabled
- Direct server-to-client communication bypassing passthrough flow
- Custom ping implementations and fine-grained transport control
- Advanced session management with separate source/target session handling

## [0.7.1] - 2025-08-13

### Changed

- **BREAKING**: Updated Config interface structure to use nested `source` and `target` objects
  - `sourceTransportType` is now `source.transportType`
  - HTTP-specific properties (`port`, `mcpPath`, `transportFactory`) now nested under `source`
  - Cleaner separation between source and target configuration
- Updated `createPassthroughProxy` to use unified interface with new Config structure
- Enhanced type definitions with separate `HttpProxyConfig` and `StdioProxyConfig` types
- Updated all examples and integration tests to use new interface

### Migration Guide

**Before (0.7.0):**
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

**After (0.7.1):**
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

## [0.7.0] - 2025-08-13

### Added

- Complete rewrite of the passthrough MCP server with protocol-level hook support
- New PassthroughContext class for managing server/client lifecycle coordination
- Export of PassthroughContext for external usage
- Server and client protocol implementations for bidirectional message routing
- Session context management with `PassthroughSessionContext` for isolated session handling
- Built on Model Context Protocol (MCP) SDK transport abstraction
- Comprehensive test coverage including unit and integration tests
- Support for graceful shutdown and cascading transport closure
- Protocol-level coordination between server and client sides
- Built on Model Context Protocol (MCP) SDK v1.17.1
- Comprehensive hooks-only integration test suite for PassthroughContext without HTTP client transport
- Support for processing all MCP requests entirely through hook chains
- Integration with @civic/server-hook for server-side initialization handling
- Test coverage for initialization, tools listing, tool execution, and error handling in hook-only mode

### Changed

- **BREAKING**: Complete rewrite from legacy implementation to new protocol-level architecture
- **BREAKING**: Updated hook interface to work at the protocol level rather than HTTP middleware level
- **BREAKING**: Removed all TransportError-related functionality from hook system
- **BREAKING**: Hook interface now supports bidirectional request/response processing with direction parameters
- Improved TypeScript support with better type exports
- Simplified architecture by removing unused getter methods from PassthroughContext
- Enhanced bidirectional hook processing with comprehensive test coverage
- Updated Hook interface to support new passthrough-mcp-server functionality
- Improved hook chain processing for better request/response handling

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

### Development

- Added @civic/server-hook as development dependency for testing
- Extended integration test coverage to validate hook-only operation modes

## Legacy History (pre-rewrite)

## [0.5.0] - 2025-01-12

### Changed
- **BREAKING**: Updated to use @civic/hook-common v0.1.0 with new hook interface
- **BREAKING**: Hooks now use MCP SDK types directly (CallToolRequest, CallToolResult)
- **BREAKING**: Hook responses use discriminated unions with resultType field
- **BREAKING**: Removed apply.ts module - processor functions are now exported directly
- Simplified hook processing by removing unnecessary abstractions
- Better TypeScript support with improved type exports

### Added
- Direct export of processor functions (processToolCallRequestThroughHooks, etc.)
- Support for local programmatic hooks alongside remote HTTP hooks
- Export of hook creation utilities for better integration

### Fixed
- Type inference issues with transport-specific proxy creation

### Removed
- apply.ts module and applyHooks function (use processor functions directly)
- Unnecessary type wrappers around MCP SDK types

## [0.4.1] - 2025-07-04

### Fixed
- Fixed workspace dependency resolution in published package by using pnpm publish instead of npm publish

## [0.4.0] - 2025-07-04

### Added
- MCP Authorization specification compliance
  - 401 response passthrough for httpStream and SSE transports
  - Authorization header forwarding to target servers
  - Non-MCP request proxying (all non-/mcp paths routed directly to target)
- Custom HTTP proxy server implementation replacing FastMCP
- Per-request MCP server instances following stateless pattern
- Session-based authorization context management
- Configurable MCP endpoint (default: /mcp)

### Changed
- **BREAKING**: Migrated from FastMCP to direct MCP SDK usage
- **BREAKING**: Default MCP endpoint changed from /stream to /mcp
- Updated to @modelcontextprotocol/sdk version 1.13.0
- Refactored server architecture for authorization support
- Enhanced session management to include authorization headers

### Fixed
- Proper handling of authorization flows for OAuth-enabled MCP servers
- Type safety improvements throughout the codebase

## [0.2.2] - 2025-06-26

### Added
- Added `processToolException` hook for handling callTool exceptions
- Enhanced error handling capabilities in hook processing pipeline

## [0.2.0] - 2025-01-09

### Added
- Simplified Hook API for external service integration
  - New `applyHooks` function providing a unified interface for processing request/response hooks
  - Hook creation utilities: `createHookClient` and `createHookClients`
  - Export of `AbstractHook` as a value for easy custom hook creation
  - Comprehensive error handling with `messageFromError` utility
- Enhanced exports from `@civic/hook-common` making the library self-contained
- Validation for tool call data in `applyHooks` function
- Processor enhancements to include rejection reasons
- Example demonstrating hook API usage patterns (`hook-api-example.ts`)
- Full test coverage for new functionality

### Added (from previous unreleased)
- Support for programmatic hooks via Hook instances in addition to URL-based hooks
- `name` getter requirement for Hook interface
- LocalHookClient implementation for programmatic hooks
- Integration tests demonstrating full MCP pipeline with programmatic hooks

### Changed
- Refactored HookClient from class to interface with RemoteHookClient and LocalHookClient implementations
- Configuration structure improvements:
  - Moved `config.server` fields to top level (`config.transportType` and `config.port`)
  - Renamed `client` to `target` for clarity
  - Renamed `target.type` to `target.transportType` for consistency
  - Changed transport type value from "stream" to "httpStream" for consistency
  - Made `port` optional for stdio transport using discriminated union types
- Removed hook client caching to prevent shared state issues in tests

### Fixed
- Test isolation issues caused by shared hook client cache

## [0.1.0] - 2025-01-06

### Added
- Programmatic API with `createPassthroughProxy` function
- TypeScript type exports for better type safety
- Support for custom client factories
- Flattened configuration interface for easier use
- Separate CLI and library entry points

### Changed
- Refactored from CLI-only tool to a library with CLI support
- Improved documentation with programmatic usage examples
- **BREAKING**: Changed from config object to flattened options in `createPassthroughProxy`

## [0.0.2] - Previous version

### Added
- Initial passthrough MCP server implementation
- Hook middleware support
- Multiple transport types (HTTP Stream, SSE, stdio)
- tRPC-based hook system