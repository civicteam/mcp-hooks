# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2025-08-14

### Changed

- Updated to align with renamed interfaces in @civic/hook-common v0.3.1
- No functional changes, only type import updates

## [0.1.0] - 2025-08-13

### Added

- **NEW PACKAGE**: MCP hook that provides server-side initialization handling and callbacks
- ServerHook class for responding to client initialization requests
- Support for server capability advertisement and client info tracking
- Protocol version validation using SUPPORTED_PROTOCOL_VERSIONS from MCP SDK
- Monitoring of notifications/initialized with callback trigger support
- `oninitialized` callback for when initialization handshake is fully complete
- Client capabilities and version tracking after successful initialization
- Reset functionality for testing and reconnection scenarios

### Features

- **ServerHook Class**: Complete server-side initialization management
- **Protocol Compliance**: Full MCP protocol version validation
- **Lifecycle Callbacks**: oninitialized callback for post-initialization logic
- **Client Tracking**: Access to client capabilities and version information
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### Technical Details

- Built on @civic/hook-common v0.3.0 with comprehensive Hook interface
- Compatible with @modelcontextprotocol/sdk v1.17.1
- ESM module format with proper import/export syntax
- Full TypeScript type definitions included
- Comprehensive test coverage with vitest