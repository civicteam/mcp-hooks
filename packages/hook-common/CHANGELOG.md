# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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