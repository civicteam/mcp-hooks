# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-08-13

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

## [0.0.1] - Previous version

### Added
- Initial simple log hook implementation
- Basic logging capabilities for MCP operations