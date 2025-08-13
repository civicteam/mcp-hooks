# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-08-13

### Added

- Comprehensive Hook interface supporting all MCP operations
- Support for bidirectional request and response processing
- New hook methods:
  - `processToolsListRequest` and `processToolsListResponse` for tools/list operations
  - `processInitializeRequest` and `processInitializeResponse` for initialization handling
  - `processOtherRequest` and `processOtherResponse` for non-standard MCP methods
  - `processTargetRequest` and `processTargetResponse` for target server communication
  - `processNotification` for handling MCP notifications
- Request context support with `RequestContext` type for HTTP metadata (headers, host, path)
- Extended request types with context: `CallToolRequestWithContext`, `ListToolsRequestWithContext`, `InitializeRequestWithContext`
- Comprehensive response types and schemas for all hook operations
- `AbstractHook` base class providing default implementations for all hook methods

### Changed

- **BREAKING**: Expanded Hook interface from basic tool operations to full MCP protocol coverage
- **BREAKING**: Removed all TransportError-related functionality and types
- **BREAKING**: Updated hook method signatures to include context and support bidirectional processing
- **BREAKING**: Hook methods now return specific result types (e.g., `CallToolRequestHookResult`, `ListToolsRequestHookResult`)
- Improved type safety with comprehensive schema validation using Zod
- Enhanced documentation and examples for hook implementations

### Removed

- **BREAKING**: All TransportError-related functions, types, and schemas
- **BREAKING**: Transport error handling from hook interface
- Legacy hook patterns that don't support the new bidirectional model

### Technical Details

- Full TypeScript support with comprehensive type definitions
- Zod schema validation for all hook result types
- Support for hook chaining and processing pipelines
- Compatible with @civic/passthrough-mcp-server v0.7.0 bidirectional processing

## [0.2.3] - 2025-08-05

### Changed
- Maintained compatibility with existing implementations
- Prepared foundation for upcoming interface changes

## [0.1.0] - 2025-01-12

### Changed
- **BREAKING**: Complete refactor to use MCP SDK types directly
- **BREAKING**: Changed from custom wrapper types to CallToolRequest/CallToolResult
- **BREAKING**: Replaced HookResponse with discriminated unions (resultType: "continue" | "abort" | "respond")
- **BREAKING**: Renamed response type from "reject" to "abort"
- **BREAKING**: Hook interface now requires a `name` getter
- **BREAKING**: Removed HookClient in favor of Hook interface
- Simplified hook interface by removing unnecessary abstractions
- Improved type safety with proper MCP SDK integration

### Added
- Support for optional hook methods (processToolsList, processToolsListResponse)
- Better error handling with abort responses
- Export of MCP SDK types for convenience

### Removed
- HookClient class (replaced with Hook interface)
- Custom ToolCall type (using CallToolRequest instead)
- HookResponse type (using discriminated unions instead)

## [0.0.4] - 2025-06-26

### Added
- Enhanced hook processing capabilities
- Improved client and router functionality for better exception handling

## [0.0.3] - Previous version

### Added
- Initial hook-common implementation
- Abstract hook base classes
- Client and router utilities
- Type definitions for hook system