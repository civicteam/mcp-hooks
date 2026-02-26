# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-18

### Added

- Initial implementation of `@civic/playwright-tokensaver-proxy`
- Single-process stdio MCP server that proxies to upstream Playwright MCP
- Built-in hook that adds `run_code_cheap` and compresses output to `success`/`failure`
- Guidance added to `browser_*` tool descriptions to prefer `run_code_cheap` when full output is unnecessary
