# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2025-08-14

### Changed

- Updated to align with renamed interfaces in @civic/hook-common v0.4.0
- No functional changes, only type import updates

## [0.3.0] - 2025-08-13

### Changed

- **BREAKING**: Updated to use @civic/hook-common v0.3.0 with new comprehensive Hook interface
- **BREAKING**: Hook methods now return specific result types with discriminated unions
- **BREAKING**: Removed TransportError handling - no longer supported in hook system
- Updated hook implementation to support bidirectional request/response processing
- Enhanced type safety with new Hook interface requirements

### Technical Details

- Compatible with @civic/hook-common v0.3.0 and @civic/passthrough-mcp-server v0.7.0
- Full TypeScript support with comprehensive type definitions
- Supports hook chaining and processing pipelines

## [0.2.0] - Previous version

### Added
- Enhanced local tools functionality
- Improved integration capabilities

## [0.1.0] - 2025-01-12

### Added
- Initial public release of @civic/local-tools-hook
- Support for defining local tools with Zod schemas
- Integration with passthrough MCP server
- Automatic tool list merging with remote servers
- Full TypeScript support with proper type inference
- Comprehensive test coverage

### Changed
- Renamed `paramsSchemaOrAnnotations` to `paramsSchema` for clarity