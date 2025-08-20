# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.3] - 2025-01-20

### Added

- **Resource Hook Methods**: Added comprehensive resource support to Hook interface
  - `processListResourcesRequest`: Process resource listing requests
  - `processListResourcesResponse`: Process resource listing responses
  - `processListResourcesError`: Process resource listing errors
  - `processListResourceTemplatesRequest`: Process resource template listing requests
  - `processListResourceTemplatesResponse`: Process resource template listing responses
  - `processListResourceTemplatesError`: Process resource template listing errors
  - `processReadResourceRequest`: Process resource reading requests
  - `processReadResourceResponse`: Process resource reading responses
  - `processReadResourceError`: Process resource reading errors
- **Resource Types and Schemas**: Added MCP SDK resource types
  - Resource listing request/response types with context
  - Resource template listing request/response types with context
  - Resource reading request/response types with context
  - Comprehensive Zod schemas for all resource operations
- **Resource Hook Result Types**: New result types for resource processing
  - `ListResourcesRequestHookResult`: Result type for resource list request processing
  - `ListResourcesResponseHookResult`: Result type for resource list response processing
  - `ListResourcesErrorHookResult`: Result type for resource list error processing
  - Similar result types for resource templates and resource reading

### Changed

- Updated `AbstractHook` to include default implementations for all resource methods
- Enhanced `LocalHookClient` to handle resource processing methods
- Updated `RemoteHookClient` to support resource operations over tRPC
- Extended router definitions to include resource processing endpoints
- Enhanced type helpers to support resource method discovery

### Technical Details

- Full support for MCP resource operations including listing, templates, and reading
- Resource hooks follow the same pattern as existing tool and initialization hooks
- Maintains backward compatibility with existing hook implementations
- Full TypeScript support with proper type inference for resource handling

## [0.4.2] - 2025-01-20

### Added

- **Error Processing Methods**: Added comprehensive error callback support to Hook interface
  - `processCallToolError`: Process errors from tool calls
  - `processListToolsError`: Process errors from tool listing
  - `processInitializeError`: Process errors from initialization
  - `processOtherError`: Process errors from other requests
  - `processTargetError`: Process errors from target server communication
- **Error Hook Result Types**: New result types for error processing
  - `CallToolErrorHookResult`: Result type for tool call error processing
  - `ListToolsErrorHookResult`: Result type for tool list error processing
  - `InitializeErrorHookResult`: Result type for initialization error processing
  - `OtherErrorHookResult`: Result type for other request error processing
  - `TargetErrorHookResult`: Result type for target error processing
- **HookChainError Type**: Standardized error type for hook chain processing
- **Generic Error Types**: Added `GenericErrorHookResult` for type-safe error handling

### Changed

- Updated `AbstractHook` to include default implementations for all error processing methods
- Enhanced `LocalHookClient` to handle error processing methods with proper exception propagation
- Updated `RemoteHookClient` to support error processing over tRPC
- Improved router definitions to include error processing endpoints
- Enhanced type helpers to support error method discovery

### Technical Details

- Error callbacks are invoked in reverse order through the hook chain
- Hooks can transform errors, recover from errors, or pass them through
- When a hook recovers from an error, subsequent hooks see a successful response
- Full TypeScript support with proper type inference for error handling

## [0.4.1] - 2025-08-19

### Added

- **BREAKING**: Added `RequestExtra` parameter to all Hook interface methods
  - New parameter provides `requestId` and optional `sessionId` for request tracking
  - Enables hooks to correlate requests and responses using unique identifiers
  - Supports session-based tracking and monitoring capabilities
- Added `RequestExtra` type with Zod schema validation
- Added `RequestIdSchema` supporting both string and number request IDs

### Changed

- **BREAKING**: All Hook interface methods now require `RequestExtra` as a parameter:
  - Request processing methods: Second parameter after the request
  - Response processing methods: Third parameter after response and original request
  - Notification processing methods: Second parameter after the notification
- Updated `AbstractHook` base class with `RequestExtra` parameter in all methods
- Updated `LocalHookClient` to pass `RequestExtra` to hook methods
- Updated `RemoteHookClient` (tRPC) to include `RequestExtra` in RPC calls
- Updated router definitions to include `RequestExtra` in input schemas
- Fixed TypeScript type helpers (`MethodsWithRequestType`, `MethodsWithResponseType`) to handle new parameter structure

### Technical Details

- Maintains backward compatibility with existing hook result types
- Request IDs enable stateless request/response correlation
- Session IDs support multi-session tracking and isolation
- Full TypeScript support with proper type inference

## [0.4.0] - 2025-08-14

### Changed

- **BREAKING**: Renamed all hook result interfaces to align with consistent naming conventions:
  - `CallToolRequestResponse` → `CallToolRequestHookResult`
  - `CallToolResponseResponse` → `CallToolResponseHookResult`
  - `ListToolsRequestResponse` → `ListToolsRequestHookResult`
  - `ListToolsResponseResponse` → `ListToolsResponseHookResult`
  - `InitializeRequestResponse` → `InitializeRequestHookResult`
  - `InitializeResponseResponse` → `InitializeResponseHookResult`
  - `OtherRequestResponse` → `OtherRequestHookResult`
  - `OtherResponseResponse` → `OtherResponseHookResult`
  - `TargetRequestResponse` → `TargetRequestHookResult`
  - `TargetResponseResponse` → `TargetResponseHookResult`
  - `NotificationResponse` → `NotificationHookResult`
- **BREAKING**: LocalHookClient no longer catches exceptions from hook methods
  - Exceptions now propagate to the caller for higher-level handling
  - Removed all try-catch blocks and error logging from LocalHookClient
- Improved naming consistency across the entire hook interface

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